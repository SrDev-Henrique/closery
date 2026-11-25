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
import { DashboardPassages } from "./DashboardPassages";

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
  render(await DashboardPassages({ actor, scope, now: world.now }));
  return screen.getByRole("region", { name: "Passagens" });
}

function numbersOf(region: HTMLElement) {
  const list = within(region).getByRole("list", {
    name: "Números das passagens",
  });
  return within(list);
}

// Esperadas · entregues · confirmadas · aguardando · não confirmadas · sem passagem.
const ULD = [19, 10, 7, 1, 2, 11] as const;
const CAMARA = [6, 2, 1, 1, 0, 4] as const;
const ALL = [25, 12, 8, 2, 2, 15] as const;

const NUMBERS = [
  { label: /^\S+ Esperadas/, param: "esperadas" },
  { label: /^\S+ Entregues/, param: "entregues" },
  { label: /^\S+ Confirmadas/, param: "confirmada" },
  { label: /^\S+ Aguardando recebimento/, param: "aguardando" },
  { label: /^\S+ Não confirmadas/, param: "nao-confirmada" },
  { label: /^\S+ Sem passagem/, param: "sem-passagem" },
] as const;

describe("DashboardPassages", () => {
  it("operador: os 6 números do mundo, cada um um link para a lista que o conta", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const numbers = numbersOf(region);
    expect(numbers.getAllByRole("link")).toHaveLength(6);
    NUMBERS.forEach(({ label, param }, index) => {
      const link = numbers.getByRole("link", { name: label });
      expect(link).toHaveAttribute("href", `/passagens?situacao=${param}`);
      expect(link.textContent, param).toMatch(new RegExp(`^${ULD[index]}`));
    });
    expect(
      screen.getByRole("heading", { level: 2, name: "Passagens" }),
    ).toBeInTheDocument();
  });

  it("o anel: legenda com as 4 situações na ordem, cada uma um link com o valor", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const legend = within(region).getByRole("list", {
      name: "Legenda da situação das passagens",
    });
    const links = within(legend).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/passagens?situacao=confirmada",
      "/passagens?situacao=aguardando",
      "/passagens?situacao=nao-confirmada",
      "/passagens?situacao=sem-passagem",
    ]);
    const values = [7, 1, 2, 11];
    links.forEach((link, index) => {
      expect(within(link).getByText(String(values[index]))).toBeInTheDocument();
    });
    expect(links[1]).toHaveTextContent("Aguardando recebimento");
    expect(links[3]).toHaveTextContent("Sem passagem");
  });

  it("o total do anel é um link para a lista do período, com o setor do admin", async () => {
    const { unmount } = render(
      await DashboardPassages({
        actor: world.people.ana,
        scope: worldScope(world, "operator"),
        now: world.now,
      }),
    );
    expect(
      screen.getByRole("link", { name: "21 passagens: ver a lista" }),
    ).toHaveAttribute("href", "/passagens");
    unmount();

    render(
      await DashboardPassages({
        actor: world.people.admin,
        scope: worldScope(world, "all"),
        now: world.now,
      }),
    );
    expect(
      screen.getByRole("link", { name: /passagens: ver a lista$/ }),
    ).toHaveAttribute("href", "/passagens?setor=todos");
  });

  it("Câmara e Todos os setores trazem os números da tabela do mundo (o Setor Parado nunca entra)", async () => {
    const { unmount } = render(
      await DashboardPassages({
        actor: world.people.cris,
        scope: worldScope(world, "operator", world.camara),
        now: world.now,
      }),
    );
    let numbers = numbersOf(screen.getByRole("region", { name: "Passagens" }));
    NUMBERS.forEach(({ label }, index) => {
      expect(numbers.getByRole("link", { name: label }).textContent).toMatch(
        new RegExp(`^${CAMARA[index]}`),
      );
    });
    unmount();

    render(
      await DashboardPassages({
        actor: world.people.admin,
        scope: worldScope(world, "all"),
        now: world.now,
      }),
    );
    numbers = numbersOf(screen.getByRole("region", { name: "Passagens" }));
    NUMBERS.forEach(({ label }, index) => {
      expect(numbers.getByRole("link", { name: label }).textContent).toMatch(
        new RegExp(`^${ALL[index]}`),
      );
    });
  });

  it("admin: os links levam o setor escolhido (id e todos)", async () => {
    const { unmount } = render(
      await DashboardPassages({
        actor: world.people.admin,
        scope: worldScope(world, "admin"),
        now: world.now,
      }),
    );
    expect(
      numbersOf(screen.getByRole("region", { name: "Passagens" })).getByRole(
        "link",
        { name: /Esperadas/ },
      ),
    ).toHaveAttribute(
      "href",
      `/passagens?situacao=esperadas&setor=${world.uld.id}`,
    );
    unmount();

    render(
      await DashboardPassages({
        actor: world.people.admin,
        scope: worldScope(world, "all"),
        now: world.now,
      }),
    );
    const region = screen.getByRole("region", { name: "Passagens" });
    expect(
      numbersOf(region).getByRole("link", { name: /Sem passagem/ }),
    ).toHaveAttribute("href", "/passagens?situacao=sem-passagem&setor=todos");
    const legend = within(region).getByRole("list", {
      name: "Legenda da situação das passagens",
    });
    for (const link of within(legend).getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/&setor=todos$/);
    }
  });

  it("os links levam o período: 30 dias e intervalo", async () => {
    const { unmount } = render(
      await DashboardPassages({
        actor: world.people.ana,
        scope: worldScope(world, "operator", world.uld, {
          period: { period: "30", from: "2026-10-22", to: "2026-11-20" },
          previous: { from: "2026-09-22", to: "2026-10-21" },
          days: 30,
        }),
        now: world.now,
      }),
    );
    expect(
      numbersOf(screen.getByRole("region", { name: "Passagens" })).getByRole(
        "link",
        { name: /Confirmadas/ },
      ),
    ).toHaveAttribute("href", "/passagens?periodo=30&situacao=confirmada");
    unmount();

    render(
      await DashboardPassages({
        actor: world.people.ana,
        scope: worldScope(world, "operator", world.uld, {
          period: { period: "range", from: "2026-11-14", to: "2026-11-16" },
          previous: { from: "2026-11-11", to: "2026-11-13" },
          days: 3,
        }),
        now: world.now,
      }),
    );
    expect(
      numbersOf(screen.getByRole("region", { name: "Passagens" })).getByRole(
        "link",
        { name: /Entregues/ },
      ),
    ).toHaveAttribute(
      "href",
      "/passagens?periodo=intervalo&de=2026-11-14&ate=2026-11-16&situacao=entregues",
    );
  });

  it("operador com o escopo de outro setor no parâmetro vê só o próprio (nada do outro vaza)", async () => {
    // O escopo diz ULD, mas quem pede é a operadora da Câmara.
    const region = await renderBlock(
      world.people.cris,
      worldScope(world, "operator", world.uld),
    );

    const numbers = numbersOf(region);
    expect(
      numbers.getByRole("link", { name: /Esperadas/ }).textContent,
    ).toMatch(/^6/);
    expect(
      numbers.getByRole("link", { name: /Sem passagem/ }).textContent,
    ).toMatch(/^4/);
  });

  it("setor sem turno nenhum: o estado vazio ensina, sem números", async () => {
    const empty = await insertSector(db, "Setor Vazio Teste");
    const operator = authzOf({
      role: "operator",
      sectorId: empty.id,
      name: "Eva Teste",
    });

    const region = await renderBlock(
      operator,
      worldScope(world, "operator", empty),
    );

    expect(
      within(region).getByText("Nenhum turno encerrado no período."),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "Os números aparecem quando um turno do período termina ou uma passagem é entregue.",
      ),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("list")).not.toBeInTheDocument();
  });

  it("operador sem setor nenhum não vê número (tudo vazio)", async () => {
    const stray: Authz = {
      userId: "user-sem-setor",
      name: "Sem Setor Teste",
      email: "sem-setor@example.test",
      role: "operator",
      sectorId: null,
    };

    const region = await renderBlock(stray, worldScope(world, "operator"));

    expect(
      within(region).getByText("Nenhum turno encerrado no período."),
    ).toBeInTheDocument();
  });
});
