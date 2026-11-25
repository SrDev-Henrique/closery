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
import { DashboardControls } from "./DashboardControls";

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
  render(await DashboardControls({ actor, scope }));
  return screen.getByRole("region", { name: "Controles" });
}

// Os links de /passagens que o bloco gera (total, legenda e segmentos).
function passageHrefs(): string[] {
  return screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/passagens"));
}

function totalLinks(region: HTMLElement): string[] {
  return within(region)
    .queryAllByRole("link", { name: /: ver as passagens do período$/ })
    .map((link) => link.getAttribute("aria-label") ?? "");
}

describe("DashboardControls", () => {
  it("ULD: um cartão por item, com o total do mundo (vigente, depois da correção) e o vazio do item sem passagem", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    // Rede 35 · Cinta 36 · Cinta antiga 3, na ordem do cadastro; Lacre ULD sem passagem.
    expect(totalLinks(region)).toEqual([
      "35 rede: ver as passagens do período",
      "36 peça: ver as passagens do período",
      "3 peça: ver as passagens do período",
    ]);
    expect(
      within(region).getAllByText("Sem passagens no período"),
    ).toHaveLength(1);
    for (const name of [
      "Rede de proteção",
      "Cinta",
      "Cinta antiga",
      "Lacre ULD",
    ]) {
      expect(within(region).getAllByText(name).length, name).toBeGreaterThan(0);
    }
    expect(
      screen.getByRole("heading", { level: 2, name: "Controles" }),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "Itens de controle: total do período, média por turno e comparação com o período anterior.",
      ),
    ).toBeInTheDocument();
  });

  it("o total e a legenda de passagens levam a lista dos entregues com o item (C-1)", async () => {
    await renderBlock(world.people.ana, worldScope(world, "operator"));

    const hrefs = passageHrefs();
    expect(hrefs).toContain(
      `/passagens?situacao=entregues&item=${world.items.net}`,
    );
    expect(hrefs).toContain(
      `/passagens?situacao=entregues&item=${world.items.oldStrap}`,
    );
    // O mesmo href do total também abre pela legenda "{n} passagens".
    const legend = screen.getAllByRole("link", { name: /passagens$/ });
    expect(
      legend
        .map((link) => link.getAttribute("href"))
        .filter(
          (href) =>
            href === `/passagens?situacao=entregues&item=${world.items.net}`,
        ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("cada segmento é um turno com link próprio, inclusive o turno inativo", async () => {
    await renderBlock(world.people.ana, worldScope(world, "operator"));

    const hrefs = passageHrefs();
    for (const shift of [
      world.shifts.morning,
      world.shifts.afternoon,
      world.shifts.night,
      world.shifts.retired,
    ]) {
      expect(hrefs).toContain(
        `/passagens?turno=${shift}&situacao=entregues&item=${world.items.net}`,
      );
    }
    // A Cinta antiga só tem linha na Manhã e no Turno Antigo, mas o setor mostra todos os turnos.
    expect(hrefs).toContain(
      `/passagens?turno=${world.shifts.retired}&situacao=entregues&item=${world.items.oldStrap}`,
    );
    // Nenhum agregado "Outros turnos".
    expect(screen.queryByText(/Outros turnos/)).not.toBeInTheDocument();
  });

  it("operador não leva ?setor= em nenhum link", async () => {
    await renderBlock(world.people.ana, worldScope(world, "operator"));

    expect(passageHrefs().length).toBeGreaterThan(0);
    for (const href of passageHrefs()) {
      expect(href).not.toContain("setor=");
    }
  });

  it("admin com um setor escolhido leva o setor do item em todos os links", async () => {
    await renderBlock(world.people.admin, worldScope(world, "admin"));

    expect(passageHrefs().length).toBeGreaterThan(0);
    for (const href of passageHrefs()) {
      expect(href).toContain(`&setor=${world.uld.id}`);
    }
  });

  it("Todos os setores: cartões dos dois setores, setor visível e links para o setor do item (nunca setor=todos)", async () => {
    const region = await renderBlock(
      world.people.admin,
      worldScope(world, "all"),
    );

    expect(within(region).getAllByText(/Câmara Teste/).length).toBeGreaterThan(
      0,
    );
    expect(within(region).getAllByText(/ULD Teste/).length).toBeGreaterThan(0);
    // Câmara primeiro (ordem por nome do setor), depois a ULD.
    expect(totalLinks(region)).toEqual([
      "6 unidade: ver as passagens do período",
      "35 rede: ver as passagens do período",
      "36 peça: ver as passagens do período",
      "3 peça: ver as passagens do período",
    ]);
    const hrefs = passageHrefs();
    expect(hrefs).toContain(
      `/passagens?situacao=entregues&item=${world.items.seal}&setor=${world.camara.id}`,
    );
    expect(hrefs).toContain(
      `/passagens?situacao=entregues&item=${world.items.net}&setor=${world.uld.id}`,
    );
    expect(hrefs).toContain(
      `/passagens?turno=${world.shifts.morning}&situacao=entregues&item=${world.items.net}&setor=${world.uld.id}`,
    );
    // A Câmara tem um turno só: um segmento só não abre o detalhamento por turno.
    expect(hrefs).not.toContain(
      `/passagens?turno=${world.shifts.camaraDay}&situacao=entregues&item=${world.items.seal}&setor=${world.camara.id}`,
    );
    for (const href of hrefs) {
      expect(href).not.toContain("setor=todos");
    }
    // O Setor Parado (inativo) nunca aparece.
    expect(within(region).queryByText(/Fita/)).not.toBeInTheDocument();
    expect(within(region).queryByText(/Setor Parado/)).not.toBeInTheDocument();
  });

  it("o período entra nos links (30 dias)", async () => {
    await renderBlock(
      world.people.ana,
      worldScope(world, "operator", world.uld, {
        period: { period: "30", from: "2026-10-22", to: "2026-11-20" },
        previous: { from: "2026-09-22", to: "2026-10-21" },
        days: 30,
      }),
    );

    for (const href of passageHrefs()) {
      expect(href).toContain("periodo=30");
    }
  });

  it("operador com o escopo de outro setor vê só o próprio (Câmara: só o Lacre)", async () => {
    const region = await renderBlock(
      world.people.cris,
      worldScope(world, "operator", world.uld),
    );

    expect(totalLinks(region)).toEqual([
      "6 unidade: ver as passagens do período",
    ]);
    expect(
      within(region).queryByText("Rede de proteção"),
    ).not.toBeInTheDocument();
    for (const href of passageHrefs()) {
      expect(href).not.toContain(world.uld.id);
      expect(href).not.toContain(world.items.net);
    }
  });

  it("sem item de controle: o estado vazio ensina; só o admin tem o atalho Ir para Itens", async () => {
    const empty = await insertSector(db, "Setor Vazio Controles");
    const operator = authzOf({ role: "operator", sectorId: empty.id });

    const region = await renderBlock(
      operator,
      worldScope(world, "operator", empty),
    );

    expect(
      within(region).getByText("Nenhum item de controle."),
    ).toBeInTheDocument();
    expect(
      within(region).getByText("Os itens de controle do setor aparecem aqui."),
    ).toBeInTheDocument();
    expect(
      within(region).queryByRole("link", { name: "Ir para Itens" }),
    ).not.toBeInTheDocument();
  });

  it("admin sem item de controle no setor escolhido vê o link Ir para Itens", async () => {
    const empty = await insertSector(db, "Setor Vazio Admin");

    const region = await renderBlock(
      world.people.admin,
      worldScope(world, "admin", empty),
    );

    expect(
      within(region).getByRole("link", { name: "Ir para Itens" }),
    ).toHaveAttribute("href", "/admin/itens");
  });

  it("acima de 30 itens mostra 30 e diz quantos existem; em Todos os setores sugere escolher um", async () => {
    const big = await insertSector(db, "Setor Grande Controles");
    for (let n = 1; n <= 31; n++) {
      await insertItem(db, {
        sectorId: big.id,
        name: `Item ${String(n).padStart(2, "0")}`,
        kind: "control",
        sortOrder: n,
      });
    }

    const { unmount } = render(
      await DashboardControls({
        actor: authzOf({ role: "operator", sectorId: big.id }),
        scope: worldScope(world, "operator", big),
      }),
    );
    let region = screen.getByRole("region", { name: "Controles" });
    expect(
      within(region).getByText("Mostrando 30 de 31 itens."),
    ).toBeInTheDocument();
    expect(within(region).queryByText("Item 31")).not.toBeInTheDocument();
    expect(within(region).getAllByText("Item 30").length).toBeGreaterThan(0);
    unmount();

    render(
      await DashboardControls({
        actor: world.people.admin,
        scope: worldScope(world, "all"),
      }),
    );
    region = screen.getByRole("region", { name: "Controles" });
    expect(
      within(region).getByText(
        "Mostrando 30 de 36 itens. Escolha um setor para ver todos.",
      ),
    ).toBeInTheDocument();
  });
});
