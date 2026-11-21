import { randomUUID } from "node:crypto";

import { test as base, expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import { todayInSaoPaulo } from "@/features/handovers/saoPaulo";

import {
  buildInviteUrl,
  countCorrections,
  E2E_BASE_URL,
  handoverOf,
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
  openE2eDb,
  userIdByEmail,
} from "./db";

const PASSWORD = "senha-de-teste-123";

// Determinismo (F3-14): o servidor do E2E usa o relógio de verdade, então todo
// cenário usa um turno 00:00–23:59 e abre /passagens/nova com ?turno=&data= de
// hoje em São Paulo. Só o cenário (f) passa pelo cartão do Início (que sugere o
// turno pelo relógio) e funciona com um único turno, em qualquer hora.
const SHIFT_START = "00:00";
const SHIFT_END = "23:59";

// Mesma estratégia dos outros specs: o app roda em produção (`next start`) com
// rate limit, então cada teste usa um IP próprio (x-forwarded-for). A base
// aleatória evita colidir com os IPs de auth.spec.ts e cadastros.spec.ts.
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
async function signUpOperator(
  page: Page,
  sectorId: string,
  name: string,
): Promise<string> {
  const email = uniqueEmail();
  const { token } = await insertInvite(db, { role: "operator", sectorId });
  await signUpWithInviteToken(page, token, { name, email });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

async function signUpAdmin(page: Page, name: string): Promise<void> {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email: uniqueEmail() });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Setor com um turno 00:00–23:59 e três itens: dois de controle e um de estoque.
async function seedSector() {
  const sector = await insertSector(db, `Setor ${unique()}`);
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Turno Dia",
    startsAt: SHIFT_START,
    endsAt: SHIFT_END,
  });
  const net = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    unit: "rolo",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita de arqueação",
    unit: "unidade",
    kind: "control",
  });
  const stretch = await insertItem(db, {
    sectorId: sector.id,
    name: "Stretch",
    unit: "rolo",
    kind: "stock",
  });
  return {
    sector,
    shift,
    net,
    tape,
    stretch,
    today: todayInSaoPaulo(new Date()),
  };
}

function newHandoverPath(data: {
  shift: { id: string };
  today: string;
}): string {
  return `/passagens/nova?turno=${data.shift.id}&data=${data.today}`;
}

const HANDOVER_PATH = /\/passagens\/[0-9a-f-]{36}$/;

// Passagem entregue por `deliveredBy` com uma contagem e os dois textos.
async function seedDeliveredHandover(
  data: Awaited<ReturnType<typeof seedSector>>,
  deliveredBy: string,
  extra: { confirmedBy?: string } = {},
) {
  const status = extra.confirmedBy ? "confirmed" : "delivered";
  const created = await insertHandover(db, {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: data.today,
    status,
    deliveredBy,
    ...(extra.confirmedBy ? { confirmedBy: extra.confirmedBy } : {}),
    nextShiftText: "Conferir o lacre do ULD 12",
    occurrencesText: "Carga atrasada no portão 3",
    shiftNameSnapshot: "Turno Dia",
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.net.id,
    quantity: 2,
    note: "Rasgada na ponta",
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.tape.id,
    quantity: 0,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.stretch.id,
    quantity: 12,
    snapshot: true,
  });
  return created;
}

test("(a) operador preenche, recarrega e vê tudo salvo, e entrega o turno", async ({
  page,
}) => {
  const data = await seedSector();
  const email = await signUpOperator(page, data.sector.id, "Ana Teste");

  await page.goto(newHandoverPath(data));
  await expect(
    page.getByRole("heading", { name: "Passagem de turno" }),
  ).toBeVisible();
  // Abrir o formulário não cria nada (GET nunca escreve) e nada começa vazio.
  await expect(page.getByRole("status")).toContainText("Nada salvo ainda.");
  expect(
    await handoverOf(db, {
      sectorId: data.sector.id,
      shiftId: data.shift.id,
      operationalDate: data.today,
    }),
  ).toBeNull();
  const net = page.getByLabel("Quantidade de Rede de proteção");
  await expect(net).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Diminuir Rede de proteção" }),
  ).toBeDisabled();

  // Controle: −/+ e observação.
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page.getByRole("button", { name: "Diminuir Rede de proteção" }).click();
  await expect(net).toHaveValue("2");
  await page
    .getByRole("button", { name: "Adicionar observação em Rede de proteção" })
    .click();
  await page
    .getByLabel("Observação de Rede de proteção")
    .fill("Rasgada na ponta");

  // Estoque: digitado, e o campo vazio ao sair vira 0.
  const stretch = page.getByLabel("Quantidade de Stretch");
  await stretch.fill("12");
  await stretch.blur();
  const tape = page.getByLabel("Quantidade de Fita de arqueação");
  await tape.fill("");
  await tape.blur();
  await expect(tape).toHaveValue("0");

  // Os dois textos.
  await page
    .getByLabel("Ocorrências do turno")
    .fill("Carga atrasada no portão 3");
  const nextShift = page.getByLabel("Fica para o próximo turno");
  await nextShift.fill("Conferir o lacre do ULD 12");
  await nextShift.blur();
  await expect(page.getByRole("status")).toContainText("Salvo às");

  // Salvou de verdade: o banco já tem o rascunho com os textos.
  const ref = {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: data.today,
  };
  await expect
    .poll(async () => (await handoverOf(db, ref))?.nextShiftText)
    .toBe("Conferir o lacre do ULD 12");
  expect((await handoverOf(db, ref))?.status).toBe("draft");

  // Recarrega: tudo continua lá, e a observação já vem aberta.
  await page.reload();
  await expect(page.getByLabel("Quantidade de Rede de proteção")).toHaveValue(
    "2",
  );
  await expect(page.getByLabel("Observação de Rede de proteção")).toHaveValue(
    "Rasgada na ponta",
  );
  await expect(page.getByLabel("Quantidade de Stretch")).toHaveValue("12");
  await expect(page.getByLabel("Ocorrências do turno")).toHaveValue(
    "Carga atrasada no portão 3",
  );
  await expect(page.getByLabel("Fica para o próximo turno")).toHaveValue(
    "Conferir o lacre do ULD 12",
  );
  await expect(page.getByRole("status")).toContainText("Último salvamento às");

  // Entrega: vai para o resumo, na ordem do briefing.
  await page.getByRole("button", { name: "Entregar turno" }).click();
  await expect(page).toHaveURL(HANDOVER_PATH);
  await expect(text(page, "Aguardando recebimento")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fica para o próximo turno" }),
  ).toBeVisible();
  await expect(text(page, "Conferir o lacre do ULD 12")).toBeVisible();
  await expect(text(page, "Rasgada na ponta")).toBeVisible();
  await expect(text(page, "Carga atrasada no portão 3")).toBeVisible();
  // O item zerado fica recolhido.
  await expect(text(page, "Demais itens: 0 (1)")).toBeVisible();

  const delivered = await handoverOf(db, ref);
  expect(delivered?.status).toBe("delivered");
  expect(delivered?.deliveredBy).toBe(await userIdByEmail(db, email));
});

test("(b) outra pessoa do setor vê a passagem no Início, lê o resumo e confirma o recebimento", async ({
  page,
}) => {
  const data = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Ana Teste",
  });
  const created = await seedDeliveredHandover(data, ana.id);
  const bia = await signUpOperator(page, data.sector.id, "Bia Teste");

  // Início: o cartão no topo, com o que fica para o próximo turno.
  await expect(
    page.getByRole("heading", { name: "Passagem para confirmar" }),
  ).toBeVisible();
  // Âncoras: a mesma frase aparece no cartão "Passagem do meu turno" com
  // ". Aguardando recebimento." no fim, quando o turno sugerido é o de hoje.
  await expect(
    text(page, /^Entregue às \d{2}:\d{2} por Ana Teste$/),
  ).toBeVisible();
  await expect(text(page, "Conferir o lacre do ULD 12")).toBeVisible();
  await page.getByRole("link", { name: "Ver passagem" }).first().click();
  await expect(page).toHaveURL(`/passagens/${created.id}`);

  // Resumo: quem recebe pode confirmar.
  await expect(text(page, "Aguardando recebimento")).toBeVisible();
  await expect(text(page, "Rede de proteção")).toBeVisible();
  await expect(text(page, "2 rolo", { exact: true })).toBeVisible();
  await page
    .getByLabel("Observação do recebimento (opcional)")
    .fill("Tudo conferido");
  await page.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(text(page, "Recebimento confirmado.")).toBeVisible();
  await expect(text(page, "Confirmada por Bia Teste")).toBeVisible();
  await expect(
    text(page, "Observação do recebimento: Tudo conferido"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar recebimento" }),
  ).toHaveCount(0);

  const confirmed = await handoverOf(db, {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: data.today,
  });
  expect(confirmed?.status).toBe("confirmed");
  expect(confirmed?.confirmedBy).toBe(await userIdByEmail(db, bia));

  // Confirmada: o cartão sai do Início.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Passagem para confirmar" }),
  ).toHaveCount(0);
});

test("(c) quem entregou o turno não vê 'Confirmar recebimento' nem o cartão no Início", async ({
  page,
}) => {
  const data = await seedSector();
  const email = await signUpOperator(page, data.sector.id, "Ana Teste");
  const created = await seedDeliveredHandover(
    data,
    await userIdByEmail(db, email),
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Passagem para confirmar" }),
  ).toHaveCount(0);

  await page.goto(`/passagens/${created.id}`);
  await expect(
    text(
      page,
      "Você entregou este turno. Outra pessoa do setor confirma o recebimento.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar recebimento" }),
  ).toHaveCount(0);
  // Quem entregou ainda corrige, até alguém confirmar.
  await expect(
    page.getByRole("link", { name: "Corrigir", exact: true }),
  ).toBeVisible();
});

test("(d) operador de outro setor não vê a passagem nem o setor alheio", async ({
  page,
}) => {
  const mine = await seedSector();
  const theirs = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: theirs.sector.id,
    name: "Ana Teste",
  });
  const created = await seedDeliveredHandover(theirs, ana.id);
  await signUpOperator(page, mine.sector.id, "Caio Teste");

  // A passagem de outro setor é "Página não encontrada", nunca "sem permissão".
  await page.goto(`/passagens/${created.id}`);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(text(page, "Conferir o lacre do ULD 12")).toHaveCount(0);

  // Montar a URL de nova passagem com o setor e o turno alheios não funciona:
  // a tela é do setor dele.
  await page.goto(
    `/passagens/nova?turno=${theirs.shift.id}&data=${theirs.today}&setor=${theirs.sector.id}`,
  );
  await expect(
    page.getByRole("heading", { name: "Passagem de turno" }),
  ).toBeVisible();
  await expect(text(page, mine.sector.name)).toBeVisible();
  await expect(text(page, theirs.sector.name)).toHaveCount(0);

  // O histórico também é só do setor dele, e não tem seletor de setor.
  await page.goto(`/passagens?setor=${theirs.sector.id}&situacao=aguardando`);
  await expect(page.getByRole("heading", { name: "Passagens" })).toBeVisible();
  await expect(text(page, /Entregue por Ana Teste/)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Setor" })).toHaveCount(0);
});

test("(e) admin escolhe o setor, corrige a confirmada com motivo e o histórico mostra 'Corrigida'", async ({
  page,
}) => {
  const data = await seedSector();
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
  const created = await seedDeliveredHandover(data, ana.id, {
    confirmedBy: bia.id,
  });
  // Outro setor ativo, aberto primeiro: clicar no setor já selecionado não faz
  // nada, e sem isso o teste dependeria da ordem alfabética dos nomes.
  const decoy = await insertSector(db, `Setor ${unique()}`);
  await signUpAdmin(page, "Dora Admin");
  await page.goto(`/?setor=${decoy.id}`);

  // O seletor de setor fica no Início; a escolha é lembrada no histórico.
  const picker = page.getByRole("group", { name: "Setor" });
  await expect(
    picker.getByRole("button", { name: decoy.name }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: data.sector.name }).click();
  await expect(page).toHaveURL(`/?setor=${data.sector.id}`);
  await expect(
    page
      .getByRole("group", { name: "Setor" })
      .getByRole("button", { name: data.sector.name }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/passagens");
  await expect(
    page
      .getByRole("group", { name: "Setor" })
      .getByRole("button", { name: data.sector.name }),
  ).toHaveAttribute("aria-pressed", "true");
  const row = page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: "Confirmada por Bia Teste" });
  await expect(row).toContainText("Entregue por Ana Teste");
  await expect(row).not.toContainText("Corrigida");
  await row.getByRole("link", { name: /^Abrir passagem/ }).click();
  await expect(page).toHaveURL(`/passagens/${created.id}`);

  // Corrigir com motivo: sem o motivo a correção não passa e o digitado fica.
  await page.getByRole("link", { name: "Corrigir com motivo" }).click();
  await expect(
    text(
      page,
      "Esta passagem já foi confirmada. A correção fica registrada com o motivo.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page
    .getByLabel("Fica para o próximo turno")
    .fill("Lacre do ULD 12 conferido");
  await page.getByRole("button", { name: "Registrar correção" }).click();
  await expect(text(page, "Informe o motivo da correção.")).toBeVisible();
  await expect(page.getByLabel("Quantidade de Rede de proteção")).toHaveValue(
    "3",
  );
  expect(await countCorrections(db, created.id)).toBe(0);

  await page.getByLabel("Motivo da correção").fill("Contagem errada");
  await page.getByRole("button", { name: "Registrar correção" }).click();
  await expect(text(page, "Correção registrada.")).toBeVisible();
  await expect(page).toHaveURL(`/passagens/${created.id}`);

  // O resumo mostra os valores corrigidos, o selo e a linha do tempo.
  await expect(text(page, "Corrigida", { exact: true })).toBeVisible();
  await expect(text(page, "3 rolo", { exact: true })).toBeVisible();
  await expect(text(page, "Lacre do ULD 12 conferido").first()).toBeVisible();
  await expect(text(page, "Rede de proteção: quantidade")).toBeVisible();
  await expect(text(page, "2 → 3")).toBeVisible();
  await expect(text(page, "Motivo: Contagem errada").first()).toBeVisible();
  expect(await countCorrections(db, created.id)).toBe(2);

  // O histórico também mostra "Corrigida".
  await page.goto("/passagens");
  await expect(
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: "Confirmada por Bia Teste" }),
  ).toContainText("Corrigida");
});

test("(f) o cartão do Início vai de 'Começar passagem' a 'Continuar passagem' depois do primeiro salvamento", async ({
  page,
}) => {
  const data = await seedSector();
  await signUpOperator(page, data.sector.id, "Davi Teste");

  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(
    text(page, "Turno sugerido pelo horário de agora."),
  ).toBeVisible();
  await expect(text(page, "Turno Dia")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continuar passagem" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Começar passagem" }).click();

  await expect(
    page.getByRole("heading", { name: "Passagem de turno" }),
  ).toBeVisible();
  const occurrences = page.getByLabel("Ocorrências do turno");
  await occurrences.fill("Primeiro registro do turno");
  await occurrences.blur();
  await expect(page.getByRole("status")).toContainText("Salvo às");

  // Risco aceito: entre 11:59 e 12:00 (São Paulo) a sugestão troca de dia.
  await page.goto("/");
  await expect(text(page, /Rascunho salvo às/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Começar passagem" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Continuar passagem" }).click();
  await expect(page.getByLabel("Ocorrências do turno")).toHaveValue(
    "Primeiro registro do turno",
  );
});
