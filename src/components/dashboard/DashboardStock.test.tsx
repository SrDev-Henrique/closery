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
import { insertItem, insertSector } from "../../../test/fixtures";
import { DashboardStock } from "./DashboardStock";

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
  render(await DashboardStock({ actor, scope }));
  return screen.getByRole("region", { name: "Estoque" });
}

// O cartão de um item: o <li> que tem o nome dele no título.
function cardOf(region: HTMLElement, name: string): HTMLElement {
  const card = within(region)
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(name) !== null);
  if (!card) throw new Error(`cartão de ${name} não encontrado`);
  return card;
}

describe("DashboardStock", () => {
  it("ULD: a última contagem do Stretch é o link da passagem (20T) com data e turno", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const card = cardOf(region, "Stretch");
    const link = within(card).getByRole("link", { name: "12 rolo" });
    expect(link).toHaveAttribute(
      "href",
      `/passagens/${world.handovers["20T"]}`,
    );
    expect(
      within(card).getByText("Contado em 20/11/2026, Tarde"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Estoque" }),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "Última contagem de cada item e a evolução no período.",
      ),
    ).toBeInTheDocument();
  });

  it("o link da última contagem tem alvo de toque de 44px no celular e a classe do desktop continua (P12)", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const link = within(cardOf(region, "Stretch")).getByRole("link", {
      name: "12 rolo",
    });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:items-center",
    );
    expect(link).toHaveClass("w-fit", "text-2xl", "hover:underline");
  });

  it("a evolução do Stretch tem um dia por linha e 'sem contagem' no dia sem contagem (18/11)", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const table = within(cardOf(region, "Stretch")).getByRole("table", {
      name: "Stretch por dia",
    });
    const rows = within(table).getAllByRole("row");
    // Cabeçalho + 7 dias (14 a 20/11).
    expect(rows).toHaveLength(8);
    const rowAt = (index: number): HTMLElement => {
      const row = rows[index];
      if (!row) throw new Error(`a linha ${index} não existe`);
      return row;
    };
    expect(within(table).getAllByText("sem contagem")).toHaveLength(1);
    expect(within(rowAt(5)).getByText("sem contagem")).toBeInTheDocument();
    expect(within(rowAt(1)).getByText("14/11/2026")).toBeInTheDocument();
    expect(within(rowAt(7)).getByText("12")).toBeInTheDocument();
  });

  it("item ativo nunca contado: 'Sem contagem' e 'Sem contagem no período.', sem link nem gráfico", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const card = cardOf(region, "Filme");
    expect(within(card).getByText("Sem contagem")).toBeInTheDocument();
    expect(
      within(card).getByText("Sem contagem no período."),
    ).toBeInTheDocument();
    expect(within(card).queryByRole("link")).not.toBeInTheDocument();
    expect(within(card).queryByRole("table")).not.toBeInTheDocument();
  });

  it("contagem anterior ao período: mostra 'antes do período' e o gráfico some", async () => {
    const region = await renderBlock(
      world.people.cris,
      worldScope(world, "operator", world.camara),
    );

    const card = cardOf(region, "Caixa térmica");
    expect(within(card).getByRole("link", { name: "4 caixa" })).toHaveAttribute(
      "href",
      `/passagens/${world.handovers.C10D}`,
    );
    expect(
      within(card).getByText("Contado em 10/11/2026, Dia · antes do período"),
    ).toBeInTheDocument();
    expect(
      within(card).getByText("Sem contagem no período."),
    ).toBeInTheDocument();
  });

  it("Todos os setores: Câmara primeiro, o setor aparece no cartão e o Setor Parado nunca", async () => {
    const region = await renderBlock(
      world.people.admin,
      worldScope(world, "all"),
    );

    const names = within(region)
      .getAllByRole("listitem")
      .map(
        (item) => item.querySelector('[data-slot="card-title"]')?.textContent,
      );
    expect(names).toEqual(["Caixa térmica", "Stretch", "Filme"]);
    expect(within(region).getAllByText(/Câmara Teste/).length).toBeGreaterThan(
      0,
    );
    expect(within(region).getAllByText(/ULD Teste/).length).toBeGreaterThan(0);
    expect(within(region).queryByText(/Setor Parado/)).not.toBeInTheDocument();
  });

  it("operador com o escopo de outro setor vê só o próprio (Câmara não vê Stretch)", async () => {
    const region = await renderBlock(
      world.people.cris,
      worldScope(world, "operator", world.uld),
    );

    expect(within(region).queryByText("Stretch")).not.toBeInTheDocument();
    expect(within(region).getAllByText("Caixa térmica").length).toBeGreaterThan(
      0,
    );
  });

  it("sem item de estoque: o estado vazio ensina e só o admin tem Ir para Itens", async () => {
    const empty = await insertSector(db, "Setor Vazio Estoque");

    const { unmount } = render(
      await DashboardStock({
        actor: authzOf({ role: "operator", sectorId: empty.id }),
        scope: worldScope(world, "operator", empty),
      }),
    );
    let region = screen.getByRole("region", { name: "Estoque" });
    expect(
      within(region).getByText("Nenhum item de estoque."),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("Os itens de estoque do setor aparecem aqui."),
    ).toBeInTheDocument();
    expect(
      within(region).queryByRole("link", { name: "Ir para Itens" }),
    ).not.toBeInTheDocument();
    unmount();

    render(
      await DashboardStock({
        actor: world.people.admin,
        scope: worldScope(world, "admin", empty),
      }),
    );
    region = screen.getByRole("region", { name: "Estoque" });
    expect(
      within(region).getByRole("link", { name: "Ir para Itens" }),
    ).toHaveAttribute("href", "/admin/itens");
  });

  it("acima de 30 itens mostra 30 e diz quantos existem", async () => {
    const big = await insertSector(db, "Setor Grande Estoque");
    for (let n = 1; n <= 31; n++) {
      await insertItem(db, {
        sectorId: big.id,
        name: `Peça ${String(n).padStart(2, "0")}`,
        kind: "stock",
        sortOrder: n,
      });
    }

    const region = await renderBlock(
      authzOf({ role: "operator", sectorId: big.id }),
      worldScope(world, "operator", big),
    );

    expect(
      within(region).getByText("Mostrando 30 de 31 itens."),
    ).toBeInTheDocument();
    expect(within(region).queryByText("Peça 31")).not.toBeInTheDocument();
  });
});
