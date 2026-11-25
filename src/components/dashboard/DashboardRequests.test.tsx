import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { db } from "@/db";
import type { Authz } from "@/features/authz/authz";
import type { DashboardScope } from "@/features/dashboard/types";
import { authzOf } from "../../../test/authz";
import { worldScope } from "../../../test/dashboardScope";
import {
  type DashboardWorld,
  seedDashboardWorld,
} from "../../../test/dashboardWorld";
import type { TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";
import { DashboardRequests } from "./DashboardRequests";

const mocks = vi.hoisted(
  (): { client: PGlite | undefined; testDb: TestDb | undefined } => ({
    client: undefined,
    testDb: undefined,
  }),
);

vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  mocks.testDb = db;
  return { db };
});

let world: DashboardWorld;

beforeAll(async () => {
  if (!mocks.testDb) throw new Error("o banco de teste não subiu");
  world = await seedDashboardWorld(mocks.testDb);
}, 60_000);

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  expect(console.error).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

async function renderBlock(actor: Authz, scope: DashboardScope) {
  render(await DashboardRequests({ actor, scope, now: world.now }));
  return screen.getByRole("region", { name: "Solicitações" });
}

function numbersOf(region: HTMLElement) {
  return within(
    within(region).getByRole("list", { name: "Números das solicitações" }),
  );
}

function rowsOf(region: HTMLElement, name: string): string[] {
  return within(within(region).getByRole("list", { name }))
    .getAllByRole("link")
    .map((link) => (link.textContent ?? "").replace(/\s+/g, " ").trim());
}

function hrefsOf(region: HTMLElement, name: string): (string | null)[] {
  return within(within(region).getByRole("list", { name }))
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
}

describe("DashboardRequests", () => {
  it("ULD: abertas 3, paradas 1 e entregues no período 5, cada uma um link da Tabela", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const numbers = numbersOf(region);
    const open = numbers.getByRole("link", { name: /Abertas agora/ });
    expect(open.textContent).toMatch(/^3/);
    expect(open).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&status=abertas",
    );
    const stale = numbers.getByRole("link", { name: /Paradas agora/ });
    expect(stale.textContent).toMatch(/^1/);
    expect(stale).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&parada=1",
    );
    expect(stale).toHaveAccessibleName(
      "1 Paradas agora há mais de 3 dias no mesmo status",
    );
    const delivered = numbers.getByRole("link", {
      name: /Entregues no período/,
    });
    expect(delivered.textContent).toMatch(/^5/);
    expect(delivered).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&entrega=7",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Solicitações" }),
    ).toBeInTheDocument();
  });

  it("tempo até a entrega: uma linha por destino com duração, quantidade e link; 'Outro' é um destino", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    expect(
      within(region).getByRole("heading", {
        level: 3,
        name: "Tempo até a entrega por destino",
      }),
    ).toBeInTheDocument();
    const name = "Tempo até a entrega por destino";
    expect(rowsOf(region, name)).toEqual([
      "Doca 3 18 h 20 min 3 entregues",
      "Doca Antiga 6 h 1 entregue",
      "Outro 30 min 1 entregue",
    ]);
    expect(hrefsOf(region, name)).toEqual([
      `/solicitacoes?visao=tabela&destino=${world.destinations.doca}&entrega=7`,
      `/solicitacoes?visao=tabela&destino=${world.destinations.inactive}&entrega=7`,
      "/solicitacoes?visao=tabela&destino=outro&entrega=7",
    ]);
  });

  it("quantidade pedida: número com unidade e quantidade de solicitações, sem as canceladas; link com o status não canceladas", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const name = "Quantidade pedida por item";
    expect(
      within(region).getByText(
        "Das solicitações criadas no período, sem as canceladas.",
      ),
    ).toBeInTheDocument();
    expect(rowsOf(region, name)).toEqual([
      "Rede de proteção 6 rede em 2 solicitações",
      "Stretch 5 rolo em 2 solicitações",
      "Cinta 2 peça em 1 solicitação",
    ]);
    expect(hrefsOf(region, name)).toEqual([
      `/solicitacoes?visao=tabela&periodo=7&status=nao-canceladas&item=${world.items.net}`,
      `/solicitacoes?visao=tabela&periodo=7&status=nao-canceladas&item=${world.items.stretch}`,
      `/solicitacoes?visao=tabela&periodo=7&status=nao-canceladas&item=${world.items.strap}`,
    ]);
    // Unidades diferentes nunca viram anel, barra nem soma.
    expect(
      within(within(region).getByRole("list", { name })).queryByText("%"),
    ).not.toBeInTheDocument();
  });

  it("Câmara tem os próprios números e Todos os setores soma os dois (o Setor Parado fica de fora)", async () => {
    const { unmount } = render(
      await DashboardRequests({
        actor: world.people.cris,
        scope: worldScope(world, "operator", world.camara),
        now: world.now,
      }),
    );
    let region = screen.getByRole("region", { name: "Solicitações" });
    expect(
      numbersOf(region).getByRole("link", { name: /Entregues no período/ })
        .textContent,
    ).toMatch(/^1/);
    expect(rowsOf(region, "Tempo até a entrega por destino")).toEqual([
      "Doca 3 35 min 1 entregue",
    ]);
    unmount();

    render(
      await DashboardRequests({
        actor: world.people.admin,
        scope: worldScope(world, "all"),
        now: world.now,
      }),
    );
    region = screen.getByRole("region", { name: "Solicitações" });
    const numbers = numbersOf(region);
    expect(
      numbers.getByRole("link", { name: /Abertas agora/ }).textContent,
    ).toMatch(/^3/);
    expect(
      numbers.getByRole("link", { name: /Paradas agora/ }).textContent,
    ).toMatch(/^1/);
    expect(
      numbers.getByRole("link", { name: /Entregues no período/ }).textContent,
    ).toMatch(/^6/);
    expect(
      numbers.getByRole("link", { name: /Abertas agora/ }),
    ).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&status=abertas&setor=todos",
    );
    expect(rowsOf(region, "Tempo até a entrega por destino")[0]).toBe(
      "Doca 3 13 h 54 min 4 entregues",
    );
    // Em Todos os setores o setor do item aparece na linha.
    expect(
      rowsOf(region, "Quantidade pedida por item").some((row) =>
        row.includes("Câmara Teste"),
      ),
    ).toBe(true);
    expect(within(region).queryByText(/Fita/)).not.toBeInTheDocument();
  });

  it("admin com um setor escolhido leva o setor em todos os links", async () => {
    const region = await renderBlock(
      world.people.admin,
      worldScope(world, "admin"),
    );

    for (const link of within(region).getAllByRole("link")) {
      expect(link.getAttribute("href")).toContain(`&setor=${world.uld.id}`);
    }
  });

  it("operador não leva ?setor= nos links", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    for (const link of within(region).getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toContain("setor=");
    }
  });

  it("o período entra nos links de entrega e de quantidade pedida (30 dias e intervalo)", async () => {
    const { unmount } = render(
      await DashboardRequests({
        actor: world.people.ana,
        scope: worldScope(world, "operator", world.uld, {
          period: { period: "30", from: "2026-10-22", to: "2026-11-20" },
          previous: { from: "2026-09-22", to: "2026-10-21" },
          days: 30,
        }),
        now: world.now,
      }),
    );
    let region = screen.getByRole("region", { name: "Solicitações" });
    expect(
      numbersOf(region).getByRole("link", { name: /Entregues no período/ }),
    ).toHaveAttribute("href", "/solicitacoes?visao=tabela&entrega=30");
    for (const href of hrefsOf(region, "Quantidade pedida por item")) {
      expect(href).toContain("periodo=30");
    }
    unmount();

    render(
      await DashboardRequests({
        actor: world.people.ana,
        scope: worldScope(world, "operator", world.uld, {
          period: { period: "range", from: "2026-11-14", to: "2026-11-16" },
          previous: { from: "2026-11-11", to: "2026-11-13" },
          days: 3,
        }),
        now: world.now,
      }),
    );
    region = screen.getByRole("region", { name: "Solicitações" });
    expect(
      numbersOf(region).getByRole("link", { name: /Entregues no período/ }),
    ).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&entrega=intervalo&entrega_de=2026-11-14&entrega_ate=2026-11-16",
    );
  });

  it("operador com o escopo de outro setor vê só o próprio (Câmara não vê Rede nem Stretch)", async () => {
    const region = await renderBlock(
      world.people.cris,
      worldScope(world, "operator", world.uld),
    );

    expect(
      within(region).queryByText(/Rede de proteção/),
    ).not.toBeInTheDocument();
    expect(rowsOf(region, "Quantidade pedida por item")).toEqual([
      "Lacre 3 unidade em 1 solicitação",
    ]);
    expect(
      numbersOf(region).getByRole("link", { name: /Abertas agora/ })
        .textContent,
    ).toMatch(/^0/);
  });

  it("setor sem solicitação: zeros escritos e os dois vazios ensinam", async () => {
    const empty = await insertSector(db, "Setor Vazio Solicitações");

    const region = await renderBlock(
      authzOf({ role: "operator", sectorId: empty.id }),
      worldScope(world, "operator", empty),
    );

    const numbers = numbersOf(region);
    for (const name of [
      /Abertas agora/,
      /Paradas agora/,
      /Entregues no período/,
    ]) {
      expect(numbers.getByRole("link", { name }).textContent).toMatch(/^0/);
    }
    expect(
      within(region).getByText("Nenhuma entrega no período."),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("Nenhum item pedido no período."),
    ).toBeInTheDocument();
    expect(
      within(region).queryByRole("list", {
        name: "Quantidade pedida por item",
      }),
    ).not.toBeInTheDocument();
  });
});
