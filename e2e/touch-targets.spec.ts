import { expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import { addDays } from "@/features/handovers/saoPaulo";

import {
  buildInviteUrl,
  E2E_BASE_URL,
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertRequest,
  insertRequestItem,
  insertUser,
  isolateFirstAccess,
  openE2eDb,
} from "./db";
import {
  ago,
  seedSector,
  signUpAdmin,
  signUpOperator,
  test,
  unique,
} from "./helpers";

// Guarda de alvos de toque (P12, ui-rules §1.4): no celular (390x844) todo
// controle visível mede pelo menos 44x44. Os testes de classe (touchTargets
// do ui/) cobrem só os primitivos; os links soltos dos nossos componentes só
// aparecem medindo a tela de verdade. Os primitivos que a P12 citava
// (SidebarMenuButton sm e ícone, InputGroup, SidebarInput) não aparecem em
// nenhuma tela: se um aparecer, este guarda reprova.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

let pool: Pool;
let db: Db;
// Os `restore` do `isolateFirstAccess` (teste do Início do admin), desfeitos em
// ordem inversa antes de fechar o pool: os specs seguintes acham o banco como antes.
const restores: (() => Promise<void>)[] = [];
test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});
test.afterAll(async () => {
  for (const restore of restores.reverse()) await restore();
  await pool.end();
});

const MIN = 44;

// Um token no formato do link de redefinição (43 caracteres base64url): só
// abre o formulário, nenhuma requisição é feita até a pessoa enviar.
const FORMAT_ONLY_TOKEN = "a".repeat(43);

// Lista os controles visíveis menores que 44px. Ficam de fora: o link `inline`
// no meio de uma frase (dentro de p, li ou label que tem mais texto que ele; um
// link `inline` sozinho numa linha, ou dentro de div, td ou span, é medido) e o
// "link esticado" do cartão (after:inset-0), cuja área de toque é o cartão
// inteiro.
async function smallTargets(page: Page): Promise<string[]> {
  // Diálogo e menu entram com zoom/deslize: medir no meio da animação dá 43px.
  await page.waitForTimeout(500);
  return page.evaluate((min) => {
    const selector =
      "a, button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=option], [role=combobox], [role=radio]";
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (
        el.closest("[aria-hidden=true],[inert],[hidden]") &&
        !el.closest("[role=dialog]")
      )
        continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;
      if (rect.width >= min && rect.height >= min) continue;
      const block = el.closest("p, li, label");
      if (
        el.tagName === "A" &&
        style.display === "inline" &&
        block !== null &&
        (block.textContent ?? "").trim() !== (el.textContent ?? "").trim()
      )
        continue;
      if ((el.getAttribute("class") ?? "").includes("after:inset-0")) continue;
      const label = (
        el.getAttribute("aria-label") ??
        el.textContent ??
        el.tagName
      )
        .trim()
        .slice(0, 40);
      small.push(
        `${el.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      );
    }
    return small;
  }, MIN);
}

// `expect.soft`: o teste continua nas outras telas e o relatório lista todos os
// achados de uma vez (uma tela por linha), em vez de parar no primeiro.
async function expectTouchSized(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect.soft(await smallTargets(page), `${path} no celular`).toEqual([]);
}

test("operador: telas públicas e do operador, menu e diálogo têm alvos de toque de 44px", async ({
  page,
}) => {
  // Cada teste mede dezenas de telas (500 ms de espera e networkidle em cada
  // uma): com a máquina carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Caio Teste",
  });
  const request = await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description: "Repor stretch",
    createdAt: ago(2 * 3_600_000),
  });
  await insertRequestItem(db, {
    requestId: request.id,
    itemId: world.stretch.id,
    quantity: 12,
  });
  // Parada há 5 dias: entra em "Paradas há mais tempo" no Início (a linha
  // inteira é um link esticado, que este guarda não mede pelo próprio link).
  await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description: "Repor fita de amarração",
    createdAt: ago(5 * 24 * 3_600_000),
  });
  // Uma passagem entregue ontem, com contagem: sem ela o /dashboard mostra o
  // estado vazio e nem o link da última contagem nem o total do anel aparecem
  // (hoje fica livre: /passagens/nova abre o formulário do turno).
  const handover = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: addDays(world.today, -1),
    status: "delivered",
    deliveredBy: caio.id,
    deliveredAt: ago(24 * 3_600_000),
    nextShiftText: "Conferir o lacre do ULD 12",
    occurrencesText: "Carga atrasada no portão 3",
    shiftNameSnapshot: "Turno Dia",
  });
  await insertHandoverItem(db, {
    handoverId: handover.id,
    itemId: world.stretch.id,
    quantity: 12,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: handover.id,
    itemId: world.net.id,
    quantity: 2,
    note: "Rasgada",
    snapshot: true,
  });

  // Antes de entrar: sem o fragmento (Link incompleto), com ele (o formulário).
  // A página anterior é sempre outra, senão a troca de fragmento não recarrega.
  await expectTouchSized(page, "/redefinir-senha");
  await expectTouchSized(page, "/entrar");
  await expectTouchSized(page, "/privacidade");
  await expectTouchSized(page, `/redefinir-senha#token=${FORMAT_ONLY_TOKEN}`);
  // O convite válido (só se abre a página, o formulário não é enviado).
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: world.sector.id,
  });
  await expectTouchSized(page, buildInviteUrl(E2E_BASE_URL, token));
  await signUpOperator(page, db, world.sector.id, "Ana Teste");

  for (const path of [
    "/bem-vindo",
    "/",
    "/passagens",
    `/passagens/nova?turno=${world.shift.id}&data=${world.today}`,
    `/passagens/${handover.id}`,
    "/solicitacoes?visao=lista",
    `/solicitacoes/${request.id}`,
    "/dashboard",
    "/conta",
  ]) {
    await expectTouchSized(page, path);
  }

  // A linha da solicitação parada do Início é um link esticado (after:inset-0):
  // o guarda ignora o link, então mede a linha.
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const rowHeights = await page
    .locator('[data-slot="open-request-row"]')
    .evaluateAll((rows) =>
      rows.map((row) => Math.round(row.getBoundingClientRect().height)),
    );
  expect(
    rowHeights.length,
    "o Início lista a solicitação parada",
  ).toBeGreaterThan(0);
  expect
    .soft(
      rowHeights.filter((height) => height < MIN),
      "linhas de solicitação do Início",
    )
    .toEqual([]);

  await page.goto("/");
  await page.getByRole("button", { name: "Alternar menu" }).click();
  await expect(
    page.getByRole("button", { name: "Fechar menu", exact: true }),
  ).toBeVisible();
  expect.soft(await smallTargets(page), "menu lateral").toEqual([]);
  await page.keyboard.press("Escape");

  await page.goto("/solicitacoes?visao=lista");
  await page.getByRole("button", { name: "Nova solicitação" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect.soft(await smallTargets(page), "diálogo Nova solicitação").toEqual([]);
});

test("admin: o Início com seletor de setor, convite, cartões e tema têm alvos de toque de 44px", async ({
  page,
}) => {
  test.slow();
  const world = await seedSector(db);
  // Um segundo setor ativo: o seletor aparece com mais de uma opção.
  await seedSector(db);
  restores.push(await isolateFirstAccess(db));
  await signUpAdmin(page, db, "Carla Teste");

  // Primeiro acesso: o cartão "Convide sua equipe" (Gerar convites e Agora não)
  // está na tela medida, junto do seletor e do switch de tema do cabeçalho.
  await expectTouchSized(page, `/?setor=${world.sector.id}`);
  await expect(
    page.getByRole("heading", { name: "Convide sua equipe" }),
  ).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Setor" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Tema escuro" })).toBeVisible();
});

test("admin: telas de cadastro e o diálogo do link de nova senha têm alvos de toque de 44px", async ({
  page,
}) => {
  // Cada teste mede dezenas de telas (500 ms de espera e networkidle em cada
  // uma): com a máquina carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  // O banco do E2E só é limpo entre execuções e a Equipe pagina de 50 em 50,
  // em ordem alfabética: o nome é único e começa por "Aaa" para ficar na
  // primeira página mesmo depois dos outros specs.
  const personName = `Aaa Teste ${unique()}`;
  await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: personName,
  });
  await signUpAdmin(page, db, "Gabriela Cadastros");

  for (const path of [
    "/admin",
    "/admin/setores",
    "/admin/turnos",
    "/admin/itens",
    "/admin/destinos",
    "/admin/equipe",
  ]) {
    await expectTouchSized(page, path);
  }

  await page.goto("/admin/equipe");
  await page
    .getByRole("button", {
      name: `Gerar link de nova senha para ${personName}`,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Link de nova senha" }),
  ).toBeVisible();
  expect
    .soft(await smallTargets(page), "diálogo Link de nova senha")
    .toEqual([]);
});
