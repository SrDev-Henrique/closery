import { randomUUID } from "node:crypto";

import {
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import {
  addDays,
  formatDateBR,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";

import {
  buildInviteUrl,
  commentsOf,
  countRequestEvents,
  E2E_BASE_URL,
  handoverOf,
  insertDestination,
  insertHandover,
  insertInvite,
  insertItem,
  insertRequest,
  insertRequestComment,
  insertRequestItem,
  insertSector,
  insertShift,
  insertUser,
  openE2eDb,
  requestByDescription,
  requestOf,
} from "./db";

const PASSWORD = "senha-de-teste-123";
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// O Quadro abre com `visao=quadro` explícito: sem `visao` o Quadro e a Lista
// estão os dois no DOM (a Lista fica escondida por CSS no desktop).
const BOARD_PATH = "/solicitacoes?visao=quadro";
const BOARD_URL = /\/solicitacoes\?visao=quadro$/;

// Turno 00:00–23:59 e a data na URL: o E2E nunca depende do relógio (F3-14).
const SHIFT_START = "00:00";
const SHIFT_END = "23:59";

// Mesma estratégia dos outros specs: o app roda em produção (`next start`) com
// rate limit, então cada teste usa um IP próprio (x-forwarded-for). A base
// aleatória evita colidir com os IPs dos outros specs.
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

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// O Next mantém a página anterior escondida na navegação (Activity): getByText
// também casa texto escondido e o modo estrito reprova. Sempre só o visível.
function text(page: Page, ...args: Parameters<Page["getByText"]>) {
  return page.getByText(...args).filter({ visible: true });
}

function unique(): string {
  return randomUUID().slice(0, 8);
}

function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

// Datas das fixtures sempre relativas a Date.now(): o padrão fixo da fixture
// sairia da janela de 30 dias com o tempo e daria "parada" diferente a cada dia.
// Para "status mudou na criação", passe só createdAt (a fixture copia para
// statusChangedAt): duas chamadas de ago() podem cair em milissegundos
// diferentes, e a fixture recusa 'requested' com as duas datas diferentes.
function ago(milliseconds: number): Date {
  return new Date(Date.now() - milliseconds);
}

// A coluna (ou o grupo) de um status no Quadro ou na Lista, só a visível. Por
// CSS e não por papel: com o Sheet aberto o Base UI põe aria-hidden no resto
// da página e getByRole não enxerga mais o que está por baixo.
function columnOf(page: Page, label: string): Locator {
  const heading = new RegExp(
    `^${label.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")}`,
  );
  return page.locator("section:visible", {
    has: page.locator("h2", { hasText: heading }),
  });
}

// O total que o servidor mostra no cabeçalho da coluna: o número que vem logo
// antes do texto "solicitações" (sr-only).
async function columnTotal(column: Locator): Promise<number> {
  const content = (await column.first().textContent()) ?? "";
  const match = /(\d+)\s*solicitações/.exec(content);
  if (!match?.[1])
    throw new Error(`total da coluna não encontrado em: ${content}`);
  return Number(match[1]);
}

function cardOf(column: Locator, description: string): Locator {
  return column.locator("article", { hasText: description });
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
async function signUpOperator(page: Page, sectorId: string, name: string) {
  const { token } = await insertInvite(db, { role: "operator", sectorId });
  await signUpWithInviteToken(page, token, { name, email: uniqueEmail() });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Setor com um turno 00:00–23:59, um item de estoque (Stretch, em rolo), um de
// controle e um destino com nome único (o destino é global).
async function seedSector() {
  const sector = await insertSector(db, `Setor ${unique()}`);
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Turno Dia",
    startsAt: SHIFT_START,
    endsAt: SHIFT_END,
  });
  const stretch = await insertItem(db, {
    sectorId: sector.id,
    name: "Stretch",
    unit: "rolo",
    kind: "stock",
  });
  await insertItem(db, {
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
    destination,
    today: todayInSaoPaulo(new Date()),
  };
}

type World = Awaited<ReturnType<typeof seedSector>>;

// Preenche e envia o diálogo "Nova solicitação" já aberto.
async function createRequestInDialog(
  page: Page,
  world: World,
  description: string,
) {
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Nova solicitação" }),
  ).toBeVisible();
  await dialog
    .getByLabel("Destino", { exact: true })
    .selectOption({ label: world.destination.name });
  await dialog.getByLabel("Descrição", { exact: true }).fill(description);
  return dialog;
}

test("(a) operador cria pelo Quadro, o cartão nasce em Solicitada e anda até Entregue", async ({
  page,
}) => {
  const world = await seedSector();
  await signUpOperator(page, world.sector.id, "Ana Teste");
  const description = `Trocar redes ${unique()}`;

  // Sem `visao`, no desktop, a pessoa cai no Quadro.
  await page.goto("/solicitacoes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Solicitações" }),
  ).toBeVisible();
  // Setor ainda sem solicitações: o estado vazio do contrato no lugar das colunas.
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Nenhuma solicitação para mostrar.",
    }),
  ).toBeVisible();
  const requested = columnOf(page, "Solicitada");

  await page.getByRole("button", { name: "Nova solicitação" }).click();
  const dialog = await createRequestInDialog(page, world, description);
  await dialog.getByRole("button", { name: "Adicionar item" }).click();
  const quantity = dialog.getByLabel("Quantidade de Stretch");
  await expect(quantity).toHaveValue("1");
  await quantity.fill("12");
  await quantity.blur();
  await dialog.getByRole("button", { name: "Criar solicitação" }).click();
  await expect(text(page, "Solicitação criada.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // O cartão aparece em Solicitada, com a contagem do servidor e "1 item".
  const card = cardOf(requested, description);
  await expect(card).toBeVisible();
  await expect.poll(() => columnTotal(requested)).toBe(1);
  await expect(card.getByText("1 item", { exact: true })).toBeVisible();
  const created = await requestByDescription(db, description);
  if (!created) throw new Error("a solicitação criada não está no banco");
  expect(created.status).toBe("requested");
  expect(created.originHandoverId).toBeNull();

  // Do cartão até Entregue, só pelos botões do próprio cartão.
  await card
    .getByRole("button", { name: "Mover para Em separação / Trânsito" })
    .click();
  const transit = columnOf(page, "Em separação / Trânsito");
  const inTransit = cardOf(transit, description);
  await expect(inTransit).toBeVisible();
  await expect.poll(() => columnTotal(transit)).toBe(1);
  await expect(cardOf(requested, description)).toHaveCount(0);

  await inTransit.getByRole("button", { name: "Mover para Entregue" }).click();
  const delivered = columnOf(page, "Entregue");
  const done = cardOf(delivered, description);
  await expect(done).toBeVisible();
  await expect.poll(() => columnTotal(delivered)).toBe(1);
  await expect(done.getByRole("button", { name: /^Mover para/ })).toHaveCount(
    0,
  );

  // Criada, movida e entregue: três eventos, e o status final no banco.
  await expect.poll(() => countRequestEvents(db, created.id)).toBe(3);
  expect((await requestOf(db, created.id))?.status).toBe("delivered");

  // A quantidade digitada (12) chegou ao banco: o detalhe mostra o item.
  await page.goto(`/solicitacoes/${created.id}`);
  await expect(
    page.locator("h1", {
      hasText: `Solicitação para ${world.destination.name}`,
    }),
  ).toBeVisible();
  await expect(text(page, "12 rolo", { exact: true })).toBeVisible();
});

test("(b) o detalhe abre em Sheet sobre o Quadro: comenta, move, fecha, volta e recarrega", async ({
  page,
}) => {
  const world = await seedSector();
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Caio Teste",
  });
  const description = `Repor stretch ${unique()}`;
  const seeded = await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description,
    createdAt: ago(2 * HOUR_MS),
  });
  await insertRequestItem(db, {
    requestId: seeded.id,
    itemId: world.stretch.id,
    quantity: 12,
  });
  await signUpOperator(page, world.sector.id, "Ana Teste");
  const detailUrl = new RegExp(`/solicitacoes/${seeded.id}$`);
  const cardLink = () =>
    page.getByRole("link", { name: description, exact: true });

  // Abrir pelo cartão: a URL vira a da solicitação e o Sheet aparece sobre o Quadro.
  await page.goto(BOARD_PATH);
  await cardLink().click();
  await expect(page).toHaveURL(detailUrl);
  const sheet = page.getByRole("dialog");
  await expect(
    sheet.getByText(`Solicitação para ${world.destination.name}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("h1", { hasText: "Solicitações" })).toBeVisible();

  // Comentar sem sair da tela.
  const comment = `Separar na doca ${unique()}`;
  await sheet.getByLabel("Novo comentário").fill(comment);
  await sheet.getByRole("button", { name: "Comentar" }).click();
  await expect(sheet.getByText(comment, { exact: true })).toBeVisible();
  await expect(sheet.getByLabel("Novo comentário")).toHaveValue("");

  // Mover pelo Sheet: o selo muda, o Sheet e a URL ficam, e o Quadro por baixo atualiza.
  await sheet
    .getByRole("button", { name: "Mover para Em separação / Trânsito" })
    .click();
  await expect(
    text(page, `“${description}” movida para Em separação / Trânsito.`),
  ).toBeVisible();
  await expect(
    sheet.getByText("Em separação / Trânsito", { exact: true }).first(),
  ).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(detailUrl);
  const transit = columnOf(page, "Em separação / Trânsito");
  await expect(cardOf(transit, description)).toBeVisible();
  await expect.poll(() => columnTotal(transit)).toBe(1);
  await expect.poll(() => columnTotal(columnOf(page, "Solicitada"))).toBe(0);

  // Fechar volta ao Quadro, com o cartão na coluna nova.
  await sheet.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(BOARD_URL);
  await expect(cardOf(transit, description)).toBeVisible();

  // Reabrir e fechar de novo com "Fechar": o Sheet some e a URL volta à do Quadro.
  await cardLink().click();
  await expect(page).toHaveURL(detailUrl);
  const reopened = page.getByRole("dialog", { name: /^Solicitação para / });
  await expect(reopened).toBeVisible();

  // Escape num diálogo de dentro do Sheet fecha só o diálogo de dentro: o
  // Sheet e a URL ficam.
  await reopened.getByRole("button", { name: "Cancelar solicitação" }).click();
  const cancelDialog = page.getByRole("dialog", {
    name: "Cancelar solicitação",
  });
  await expect(cancelDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cancelDialog).toHaveCount(0);
  await expect(reopened).toBeVisible();
  await expect(page).toHaveURL(detailUrl);

  await reopened
    .getByRole("button", { name: /^Apagar comentário de / })
    .click();
  const deleteDialog = page.getByRole("dialog", { name: "Apagar comentário?" });
  await expect(deleteDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(deleteDialog).toHaveCount(0);
  await expect(reopened).toBeVisible();
  await expect(reopened.getByText(comment, { exact: true })).toBeVisible();
  // Usar o Sheet depois do Escape: se o Escape tivesse vazado para o Sheet, o
  // router.back() assíncrono o tiraria daqui e o campo não aceitaria o texto.
  const draft = `Rascunho ${unique()}`;
  await reopened.getByLabel("Novo comentário").fill(draft);
  await expect(reopened.getByLabel("Novo comentário")).toHaveValue(draft);
  await expect(page).toHaveURL(detailUrl);

  await reopened.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(BOARD_URL);

  // Voltar no histórico também fecha, com o Quadro intacto.
  await cardLink().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(BOARD_URL);
  await expect(page.locator("h1", { hasText: "Solicitações" })).toBeVisible();
  await expect(cardOf(transit, description)).toBeVisible();

  // Recarregar com o Sheet aberto abre a página completa (sem Sheet), com o comentário.
  await cardLink().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(detailUrl);
  await expect(
    page.locator("h1", {
      hasText: `Solicitação para ${world.destination.name}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(text(page, comment, { exact: true })).toBeVisible();

  // O ↗ do cartão também abre a página completa.
  await page.goto(BOARD_PATH);
  await page
    .getByRole("link", { name: `Abrir página completa de ${description}` })
    .click();
  await expect(page).toHaveURL(detailUrl);
  await expect(
    page.locator("h1", {
      hasText: `Solicitação para ${world.destination.name}`,
    }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  expect((await requestOf(db, seeded.id))?.status).toBe("in_transit");
  expect((await commentsOf(db, seeded.id)).map((row) => row.body)).toContain(
    comment,
  );
});

test("(c) outra pessoa do mesmo setor abre a página completa e vê o comentário", async ({
  page,
}) => {
  const world = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Ana Teste",
  });
  const description = `Levar fita à doca ${unique()}`;
  const comment = `Já separei metade ${unique()}`;
  const seeded = await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: ana.id,
    destinationId: world.destination.id,
    description,
    createdAt: ago(3 * HOUR_MS),
  });
  await insertRequestComment(db, {
    requestId: seeded.id,
    authorId: ana.id,
    body: comment,
    createdAt: ago(HOUR_MS),
  });
  await signUpOperator(page, world.sector.id, "Bia Teste");

  await page.goto(`/solicitacoes/${seeded.id}`);

  await expect(
    page.locator("h1", {
      hasText: `Solicitação para ${world.destination.name}`,
    }),
  ).toBeVisible();
  await expect(text(page, description, { exact: true })).toBeVisible();
  await expect(text(page, comment, { exact: true })).toBeVisible();
  await expect(text(page, "Ana Teste", { exact: true }).first()).toBeVisible();
  // Só quem escreveu apaga: Bia não vê "Apagar" no comentário da Ana.
  await expect(
    page.getByRole("button", { name: /^Apagar comentário/ }),
  ).toHaveCount(0);
  // Mas pode comentar e mover (qualquer pessoa do setor).
  await expect(page.getByLabel("Novo comentário")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mover para Em separação / Trânsito" }),
  ).toBeVisible();
});

test("(d) cancelar exige o motivo; o motivo vai para a linha do tempo e a solicitação para o grupo Cancelada", async ({
  page,
}) => {
  const world = await seedSector();
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Caio Teste",
  });
  const description = `Pedido duplicado ${unique()}`;
  const seeded = await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description,
    createdAt: ago(2 * HOUR_MS),
  });
  await signUpOperator(page, world.sector.id, "Ana Teste");
  const reason = `Já tinha sido pedido ${unique()}`;

  await page.goto(`/solicitacoes/${seeded.id}`);
  await page.getByRole("button", { name: "Cancelar solicitação" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Cancelar solicitação" }),
  ).toBeVisible();

  // Sem motivo: o erro fica no campo e nada é gravado.
  await dialog.getByRole("button", { name: "Cancelar solicitação" }).click();
  await expect(
    dialog.getByText("Informe o motivo do cancelamento."),
  ).toBeVisible();
  expect((await requestOf(db, seeded.id))?.status).toBe("requested");

  // Com motivo: cancela, e a linha do tempo mostra quem e por quê.
  await dialog.getByLabel("Motivo do cancelamento").fill(reason);
  await dialog.getByRole("button", { name: "Cancelar solicitação" }).click();
  await expect(text(page, "Solicitação cancelada.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(text(page, /Ana Teste cancelou/)).toBeVisible();
  await expect(text(page, `Motivo: ${reason}`, { exact: true })).toBeVisible();
  // O motivo também está nos comentários, com o rótulo, e não se apaga.
  await expect(
    text(page, "Motivo do cancelamento", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Apagar comentário/ }),
  ).toHaveCount(0);

  expect((await requestOf(db, seeded.id))?.status).toBe("cancelled");
  expect(await commentsOf(db, seeded.id)).toEqual([
    { body: reason, deleted: false, isReason: true },
  ]);
  expect(await countRequestEvents(db, seeded.id)).toBe(2);

  // Na Lista, a solicitação está no grupo Cancelada.
  await page.goto("/solicitacoes?visao=lista");
  const group = columnOf(page, "Cancelada");
  await expect(group).toBeVisible();
  await expect(
    group.getByRole("link", { name: description, exact: true }),
  ).toBeVisible();
  await expect.poll(() => columnTotal(group)).toBe(1);
});

test("(e) cria a solicitação pela passagem: fica ligada a ela, abre em Sheet sem perder o formulário e volta pela origem", async ({
  page,
}) => {
  const world = await seedSector();
  await signUpOperator(page, world.sector.id, "Ana Teste");
  // Ontem, para que um parâmetro perdido na navegação apareça como outro dia.
  const yesterday = addDays(world.today, -1);
  const ref = {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: yesterday,
  };
  const occurrences = `Carga atrasada no portão ${unique()}`;
  const description = `Pedir stretch ${unique()}`;

  await page.goto(`/passagens/nova?turno=${world.shift.id}&data=${yesterday}`);
  await page.getByLabel("Ocorrências do turno").fill(occurrences);
  await page.getByLabel("Ocorrências do turno").blur();
  await expect(page.getByRole("status")).toContainText("Salvo às");

  // A seção do formulário: abertas agora + "Nova solicitação" ligada a esta passagem.
  const section = page.locator("section", {
    has: page.locator("h2", { hasText: "Solicitações abertas" }),
  });
  await expect(text(page, "Nenhuma solicitação aberta.")).toBeVisible();
  await section.getByRole("button", { name: "Nova solicitação" }).click();
  const dialog = await createRequestInDialog(page, world, description);
  await dialog.getByRole("button", { name: "Criar solicitação" }).click();
  await expect(text(page, "Solicitação criada.")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const link = section.getByRole("link", { name: description, exact: true });
  await expect(link).toBeVisible();

  // A ligação está no banco: a solicitação aponta para o rascunho desta passagem.
  const created = await requestByDescription(db, description);
  const draft = await handoverOf(db, ref);
  if (!created || !draft) throw new Error("solicitação ou rascunho ausentes");
  expect(draft.status).toBe("draft");
  expect(created.originHandoverId).toBe(draft.id);

  // Abrir pela seção: Sheet sobre o formulário. Comentar não fecha nem mexe nele.
  await link.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/solicitacoes/${created.id}$`));
  const comment = `Pedido feito pela passagem ${unique()}`;
  await sheet.getByLabel("Novo comentário").fill(comment);
  await sheet.getByRole("button", { name: "Comentar" }).click();
  await expect(sheet.getByText(comment, { exact: true })).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(page.getByLabel("Ocorrências do turno")).toHaveValue(
    occurrences,
  );
  await expect(page.getByLabel("Turno", { exact: true })).toHaveValue(
    world.shift.id,
  );
  await expect(page.getByLabel("Data", { exact: true })).toHaveValue(yesterday);

  // A origem: "Criada na passagem de Turno Dia de {ontem}" leva de volta ao formulário.
  await sheet
    .getByRole("link", {
      name: `Criada na passagem de Turno Dia de ${formatDateBR(yesterday)}`,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/passagens\/nova\?/);
  await expect(page.getByLabel("Ocorrências do turno")).toHaveValue(
    occurrences,
  );
  await expect(page.getByLabel("Data", { exact: true })).toHaveValue(yesterday);
});

test("(f) operador de outro setor não vê a solicitação nem o setor alheio", async ({
  page,
}) => {
  const mine = await seedSector();
  const theirs = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: theirs.sector.id,
    name: "Ana Teste",
  });
  const description = `Pedido do outro setor ${unique()}`;
  const seeded = await insertRequest(db, {
    sectorId: theirs.sector.id,
    createdBy: ana.id,
    destinationId: theirs.destination.id,
    description,
    createdAt: ago(2 * HOUR_MS),
  });
  await signUpOperator(page, mine.sector.id, "Caio Teste");

  // A página completa de outro setor é "Página não encontrada", nunca "sem permissão".
  await page.goto(`/solicitacoes/${seeded.id}`);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(text(page, description)).toHaveCount(0);

  // Montar o ?setor= do outro setor não vale: a tela é do setor dele.
  await page.goto(`/solicitacoes?visao=quadro&setor=${theirs.sector.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Solicitações" }),
  ).toBeVisible();
  await expect(text(page, description)).toHaveCount(0);
  expect((await requestOf(db, seeded.id))?.status).toBe("requested");
});

test("(g) a passagem entregue mostra as abertas na entrega, com o status daquele instante e o de agora", async ({
  page,
}) => {
  const world = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Ana Teste",
  });
  const delivered = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: world.today,
    status: "delivered",
    deliveredBy: ana.id,
    deliveredAt: ago(HOUR_MS),
    shiftNameSnapshot: "Turno Dia",
  });
  // Criada há 2 h (aberta na entrega) e entregue há 30 min (depois da entrega).
  // insertRequest grava também os eventos e o status de agora; um
  // insertRequestEvent sozinho não mudaria `request.status`.
  const description = `Repor fita ${unique()}`;
  await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: ana.id,
    destinationId: world.destination.id,
    description,
    status: "delivered",
    createdAt: ago(2 * HOUR_MS),
    statusChangedAt: ago(HOUR_MS / 2),
  });
  await signUpOperator(page, world.sector.id, "Bia Teste");

  await page.goto(`/passagens/${delivered.id}`);

  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "Solicitações abertas" }),
  });
  await expect(section).toBeVisible();
  await expect(
    section.getByText(
      /^Como estavam na entrega, em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}\.$/,
    ),
  ).toBeVisible();
  await expect(
    section.getByRole("link", { name: description, exact: true }),
  ).toBeVisible();
  await expect(section.getByText("Solicitada", { exact: true })).toBeVisible();
  await expect(
    section.getByText("Agora: Entregue", { exact: true }),
  ).toBeVisible();
  // A seção vem logo depois de "Fica para o próximo turno".
  await expect(
    page.getByRole("heading", { name: "Fica para o próximo turno" }),
  ).toBeVisible();
});

test("(h) a solicitação parada aparece com o selo no Quadro e no cartão do Início", async ({
  page,
}) => {
  const world = await seedSector();
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Caio Teste",
  });
  const description = `Esquecida há dias ${unique()}`;
  // 5 dias e 1 hora: o selo diz "5 dias" em qualquer hora do dia.
  const stuckSince = ago(5 * DAY_MS + HOUR_MS);
  await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description,
    createdAt: stuckSince,
    statusChangedAt: stuckSince,
  });
  await signUpOperator(page, world.sector.id, "Ana Teste");

  await page.goto(BOARD_PATH);
  const card = cardOf(columnOf(page, "Solicitada"), description);
  await expect(card).toBeVisible();
  await expect(
    card.getByText("Parada há 5 dias", { exact: true }),
  ).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 2, name: "Solicitações" }),
  ).toBeVisible();
  await expect(text(page, /\b1 parada\b/)).toBeVisible();
  await expect(text(page, "Paradas há mais tempo")).toBeVisible();
  await expect(
    page.getByRole("link", { name: description, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver solicitações" }),
  ).toHaveAttribute("href", "/solicitacoes");
});

test("(i) uma URL desconhecida, logado, continua 404 (o slot do detalhe não a engole)", async ({
  page,
}) => {
  const world = await seedSector();
  await signUpOperator(page, world.sector.id, "Ana Teste");

  const missing = await page.goto("/nao-existe");
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();

  const deep = await page.goto("/rota-que-nao-existe/abc");
  expect(deep?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
});
