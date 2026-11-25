import type { PGlite } from "@electric-sql/pglite";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chooseSectorAction } from "@/app/(app)/actions";
import { db } from "@/db";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertDestination,
  insertItem,
  insertRequest,
  insertRequestItem,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { RequestsScreen } from "./RequestsScreen";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    readRememberedSector: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    readRememberedSector: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/handovers/sectorCookie", () => ({
  readRememberedSector: mocks.readRememberedSector,
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  createRequestAction: vi.fn(),
  moveRequestAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// 23/11/2026 14:30 em São Paulo. Só o Date é falso: o PGlite continua real.
const NOW = spDate("2026-11-23", "14:30");
const DAY = 86_400_000;
const NIL_ID = "00000000-0000-4000-8000-000000000000";

async function renderScreen(search: Record<string, string> = {}) {
  render(await RequestsScreen({ searchParams: Promise.resolve(search) }));
}

async function seed() {
  const sector = await insertSector(db, "Setor Teste");
  const other = await insertSector(db, "Setor Outro");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Bia Teste",
  });
  const doca = await insertDestination(db, { name: "Doca 3" });
  return { sector, other, ana, bia, doca };
}

function operator(sectorId: string, userId: string) {
  mocks.requireUser.mockResolvedValue(
    authzOf({ role: "operator", sectorId, userId, name: "Ana Teste" }),
  );
}

function admin() {
  mocks.requireUser.mockResolvedValue(
    authzOf({ role: "admin", userId: "admin-1", name: "Admin Teste" }),
  );
}

const column = (name: string) => screen.getByRole("region", { name });

describe("RequestsScreen", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.readRememberedSector.mockReset();
    mocks.readRememberedSector.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("operador: título, subtítulo do quadro, só o próprio setor e sem seletor", async () => {
    const { sector, other, ana, bia, doca } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      description: "Rolos para a doca",
      createdAt: new Date(NOW.getTime() - 2 * DAY),
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Cabo entregue",
      status: "delivered",
      createdAt: new Date(NOW.getTime() - 3 * DAY),
      statusChangedAt: new Date(NOW.getTime() - 1 * DAY),
    });
    await insertRequest(db, {
      sectorId: other.id,
      createdBy: bia.id,
      description: "Do outro setor",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "quadro", setor: other.id });

    expect(
      screen.getByRole("heading", { level: 1, name: "Solicitações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 solicitada · 0 em separação / trânsito · 1 entregue nos últimos 30 dias",
      ),
    ).toBeInTheDocument();
    expect(
      within(column("Solicitada")).getByRole("link", {
        name: "Rolos para a doca",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Do outro setor")).toBeNull();
    expect(screen.queryByRole("group", { name: "Setor" })).toBeNull();
    expect(screen.queryByText("Setor Teste")).toBeNull();
  });

  it("admin em Todos os setores vê o setor na linha e o seletor com Todos", async () => {
    const { sector, other, ana, bia } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Do setor teste",
    });
    await insertRequest(db, {
      sectorId: other.id,
      createdBy: bia.id,
      description: "Do setor outro",
    });
    admin();

    await renderScreen({ visao: "quadro", setor: "todos" });

    const picker = screen.getByRole("group", { name: "Setor" });
    expect(
      within(picker).getByRole("button", { name: "Todos os setores" }),
    ).toHaveAttribute("aria-pressed", "true");
    const requested = column("Solicitada");
    expect(within(requested).getByText("Do setor teste")).toBeInTheDocument();
    expect(within(requested).getByText("Do setor outro")).toBeInTheDocument();
    expect(within(requested).getByText("Setor Teste")).toBeInTheDocument();
    expect(within(requested).getByText("Setor Outro")).toBeInTheDocument();
  });

  it("admin: o seletor leva o query canônico dos filtros, sem o setor e sem o que é lixo (P45)", async () => {
    const { sector, other } = await seed();
    vi.mocked(chooseSectorAction).mockReset();
    vi.mocked(chooseSectorAction).mockResolvedValue({ ok: true });
    admin();

    await renderScreen({
      setor: sector.id,
      visao: "quadro",
      periodo: "30",
      busca: "rede",
      mais_solicitada: "40",
      foo: "bar",
    });
    await userEvent.click(
      within(screen.getByRole("group", { name: "Setor" })).getByRole("button", {
        name: other.name,
      }),
    );

    expect(chooseSectorAction).toHaveBeenCalledTimes(1);
    expect(chooseSectorAction).toHaveBeenCalledWith({
      sectorId: other.id,
      path: "/solicitacoes",
      query: "visao=quadro&periodo=30&busca=rede&mais_solicitada=40",
    });
  });

  it("admin com um setor escolhido vê só ele, sem o nome do setor na linha", async () => {
    const { sector, other, ana, bia } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Do setor teste",
    });
    await insertRequest(db, {
      sectorId: other.id,
      createdBy: bia.id,
      description: "Do setor outro",
    });
    admin();

    await renderScreen({ visao: "quadro", setor: sector.id });

    expect(screen.getByText("Do setor teste")).toBeInTheDocument();
    expect(screen.queryByText("Do setor outro")).toBeNull();
    expect(within(column("Solicitada")).queryByText("Setor Teste")).toBeNull();
  });

  it("operador de setor inativo vê o estado vazio e nada mais", async () => {
    const sector = await insertSector(db, "Setor Parado", { active: false });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    operator(sector.id, ana.id);

    await renderScreen();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Peça a um administrador para reativá-lo."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nova solicitação" }),
    ).toBeNull();
  });

  it("admin sem setor ativo vê o caminho para Setores", async () => {
    await insertSector(db, "Setor Parado", { active: false });
    admin();

    await renderScreen();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });

  it("vazio sem filtro: texto novo, com o convite para criar", async () => {
    const { sector, ana } = await seed();
    operator(sector.id, ana.id);

    await renderScreen({ visao: "quadro" });

    expect(
      screen.getByText("Nenhuma solicitação para mostrar."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Aparecem aqui as abertas e as entregues ou canceladas nos últimos 30 dias. Use “Nova solicitação” para criar uma.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Nova solicitação" }),
    ).toBeInTheDocument();
  });

  it("vazio na Tabela tem texto próprio", async () => {
    const { sector, ana } = await seed();
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela" });

    expect(screen.getByText("0 solicitações")).toBeInTheDocument();
    expect(
      screen.getByText("Use “Nova solicitação” para criar uma."),
    ).toBeInTheDocument();
  });

  it("vazio com filtro: texto de filtro e link para limpar", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, { sectorId: sector.id, createdBy: ana.id });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "lista", busca: "nada disso" });

    expect(
      screen.getByText("Nenhuma solicitação com esses filtros."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mude ou limpe os filtros para ver mais."),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Limpar filtros" });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/solicitacoes?visao=lista");
    }
  });

  it("a busca ignora acento e caixa", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Separação rápida de fita",
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Outra coisa",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "quadro", busca: "SEPARACAO RAPIDA" });

    expect(screen.getByText("Separação rápida de fita")).toBeInTheDocument();
    expect(screen.queryByText("Outra coisa")).toBeNull();
  });

  it("?criador= e ?destino= desconhecidos são ignorados; ?destino=outro vale", async () => {
    const { sector, ana, doca } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      description: "Para a doca",
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationOther: "Galpão Anexo",
      description: "Para o galpão",
    });
    operator(sector.id, ana.id);

    await renderScreen({
      visao: "lista",
      criador: "desconhecido",
      destino: NIL_ID,
    });
    expect(screen.getByText("Para a doca")).toBeInTheDocument();
    expect(screen.getByText("Para o galpão")).toBeInTheDocument();
    expect(screen.getByLabelText("Quem criou")).toHaveValue("all");
    expect(screen.getByLabelText("Destino")).toHaveValue("all");
  });

  it("?destino=outro filtra só os destinos digitados", async () => {
    const { sector, ana, doca } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
      description: "Para a doca",
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationOther: "Galpão Anexo",
      description: "Para o galpão",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "lista", destino: "outro" });

    expect(screen.queryByText("Para a doca")).toBeNull();
    expect(screen.getByText("Para o galpão")).toBeInTheDocument();
    expect(screen.getByLabelText("Destino")).toHaveValue("outro");
  });

  it("sem visao renderiza o Quadro e a Lista, dois seletores com o aria-current certo e nenhum id repetido", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, { sectorId: sector.id, createdBy: ana.id });
    operator(sector.id, ana.id);

    await renderScreen();

    const navs = screen.getAllByRole("navigation", { name: "Visão" });
    expect(navs).toHaveLength(2);
    const [listNav, boardNav] = navs;
    if (!listNav || !boardNav) throw new Error("faltou um seletor de visão");
    expect(listNav).toHaveClass("md:hidden");
    expect(
      within(listNav).getByRole("link", { name: "Lista" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(listNav).getByRole("link", { name: "Quadro" }),
    ).not.toHaveAttribute("aria-current");
    expect(boardNav).toHaveClass("hidden", "md:flex");
    expect(
      within(boardNav).getByRole("link", { name: "Quadro" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("region", { name: "Solicitada" })).toHaveLength(
      2,
    );

    const ids = Array.from(document.querySelectorAll("[id]")).map(
      (element) => element.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("com visao=lista só a Lista, com os quatro grupos", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, { sectorId: sector.id, createdBy: ana.id });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "lista" });

    expect(screen.getAllByRole("navigation", { name: "Visão" })).toHaveLength(
      1,
    );
    expect(screen.getByRole("link", { name: "Lista" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("region", { name: "Cancelada" }),
    ).toBeInTheDocument();
  });

  it("a Tabela mostra o subtítulo, as colunas e a contagem de itens e de dias", async () => {
    const { sector, ana } = await seed();
    const stock = await insertItem(db, {
      sectorId: sector.id,
      kind: "stock",
      name: "Fita",
    });
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Fita para a doca",
      createdAt: new Date(NOW.getTime() - 5 * DAY),
    });
    await insertRequestItem(db, {
      requestId: created.id,
      itemId: stock.id,
      quantity: 12,
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela" });

    expect(screen.getByText("1 solicitação")).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Fita para a doca/ });
    const cells = within(row).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("1");
    expect(cells[3]).toHaveTextContent("Ana Teste");
    expect(cells[4]).toHaveTextContent("18/11/2026");
    expect(cells[6]).toHaveTextContent("5");
    expect(within(row).getByText("Parada há 5 dias")).toBeInTheDocument();
  });

  it("a Tabela não aplica a janela de 30 dias e pagina de 50 em 50", async () => {
    const { sector, ana } = await seed();
    for (let index = 0; index < 51; index += 1) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        description: `Antiga ${String(index).padStart(2, "0")}`,
        status: "delivered",
        createdAt: new Date(NOW.getTime() - (60 + index) * DAY),
        statusChangedAt: new Date(NOW.getTime() - (50 + index) * DAY),
      });
    }
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela" });

    expect(screen.getByText("51 solicitações")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(51);
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&pagina=2",
    );
  });

  it("no Quadro Entregue só traz os últimos 30 dias, e com período a nota some", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Entregue há 29 dias",
      status: "delivered",
      createdAt: new Date(NOW.getTime() - 40 * DAY),
      statusChangedAt: new Date(NOW.getTime() - 29 * DAY),
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Entregue há 31 dias",
      status: "delivered",
      createdAt: new Date(NOW.getTime() - 40 * DAY),
      statusChangedAt: new Date(NOW.getTime() - 31 * DAY),
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "quadro" });

    expect(screen.getByText("Entregue há 29 dias")).toBeInTheDocument();
    expect(screen.queryByText("Entregue há 31 dias")).toBeNull();
    expect(
      within(column("Entregue")).getByText("Últimos 30 dias"),
    ).toBeInTheDocument();
  });

  it("a coluna cheia mostra Carregar mais com o total do servidor", async () => {
    const { sector, ana } = await seed();
    for (let index = 0; index < 25; index += 1) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        description: `Pedido ${String(index).padStart(2, "0")}`,
        createdAt: new Date(NOW.getTime() - (index + 1) * 60_000),
      });
    }
    operator(sector.id, ana.id);

    await renderScreen({ visao: "quadro" });

    const requested = column("Solicitada");
    expect(within(requested).getByText("25")).toBeInTheDocument();
    expect(within(requested).getAllByRole("article")).toHaveLength(20);
    expect(within(requested).getByText("20 de 25")).toBeInTheDocument();
    expect(
      within(requested).getByRole("button", { name: "Carregar mais" }),
    ).toBeInTheDocument();
  });

  it("Nova solicitação: operador não escolhe setor; admin em Todos escolhe", async () => {
    const { sector, ana } = await seed();
    operator(sector.id, ana.id);
    await renderScreen({ visao: "quadro" });
    await userEvent.click(
      screen.getByRole("button", { name: "Nova solicitação" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Nova solicitação",
    });
    expect(within(dialog).queryByLabelText("Setor")).toBeNull();
    expect(within(dialog).getByLabelText("Destino")).toBeInTheDocument();
  });

  it("Nova solicitação do admin em Todos os setores tem o campo Setor", async () => {
    await seed();
    admin();
    await renderScreen({ visao: "quadro", setor: "todos" });

    await userEvent.click(
      screen.getByRole("button", { name: "Nova solicitação" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Nova solicitação",
    });
    expect(within(dialog).getByLabelText("Setor")).toBeInTheDocument();
  });
});

// Os filtros que os números do dashboard abrem: status, parada, entrega e item.
describe("RequestsScreen: filtros novos", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.readRememberedSector.mockReset();
    mocks.readRememberedSector.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("?status= filtra e o seletor mostra o status aplicado", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Ainda solicitada",
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Já entregue",
      status: "delivered",
      createdAt: new Date(NOW.getTime() - 3 * DAY),
      statusChangedAt: new Date(NOW.getTime() - DAY),
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela", status: "entregue" });

    expect(screen.getByText("Já entregue")).toBeInTheDocument();
    expect(screen.queryByText("Ainda solicitada")).toBeNull();
    expect(screen.getByLabelText("Status")).toHaveValue("delivered");
    expect(screen.getByText("1 solicitação")).toBeInTheDocument();
  });

  it("?status=nao-canceladas e ?status=abertas valem; lixo vira todos", async () => {
    const { sector, ana } = await seed();
    for (const [description, status] of [
      ["Pedido aberto", "requested"],
      ["Pedido entregue", "delivered"],
      ["Pedido cancelado", "cancelled"],
    ] as const) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: ana.id,
        description,
        status,
        createdAt: new Date(NOW.getTime() - 3 * DAY),
        statusChangedAt:
          status === "requested"
            ? new Date(NOW.getTime() - 3 * DAY)
            : new Date(NOW.getTime() - DAY),
      });
    }
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela", status: "nao-canceladas" });
    expect(screen.getByText("Pedido aberto")).toBeInTheDocument();
    expect(screen.getByText("Pedido entregue")).toBeInTheDocument();
    expect(screen.queryByText("Pedido cancelado")).toBeNull();
    expect(screen.getByLabelText("Status")).toHaveValue("not_cancelled");
  });

  it("?status= desconhecido cai em Todos os status", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Qualquer",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela", status: "<script>" });

    expect(screen.getByText("Qualquer")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("all");
  });

  it("?parada=1 mostra só as paradas há mais de 72 h", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Pedido antigo",
      createdAt: new Date(NOW.getTime() - 4 * DAY),
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Pedido de 72 h exatas",
      createdAt: new Date(NOW.getTime() - 3 * DAY),
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela", parada: "1" });

    expect(screen.getByText("Pedido antigo")).toBeInTheDocument();
    expect(screen.queryByText("Pedido de 72 h exatas")).toBeNull();
    expect(screen.getByLabelText("Paradas")).toHaveValue("stale");
  });

  it("?entrega= no Quadro: a janela de 30 dias some e a nota não aparece", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Entregue há 40 dias",
      status: "delivered",
      createdAt: new Date(NOW.getTime() - 45 * DAY),
      statusChangedAt: new Date(NOW.getTime() - 40 * DAY),
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "quadro" });
    expect(screen.queryByText("Entregue há 40 dias")).toBeNull();
    cleanup();

    await renderScreen({
      visao: "quadro",
      entrega: "intervalo",
      entrega_de: "2026-10-01",
      entrega_ate: "2026-11-23",
    });

    expect(screen.getByText("Entregue há 40 dias")).toBeInTheDocument();
    expect(
      within(column("Entregue")).queryByText("Últimos 30 dias"),
    ).toBeNull();
    expect(
      screen.getByText(
        "0 solicitadas · 0 em separação / trânsito · 1 entregue",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Entregue em")).toHaveValue("range");
    expect(screen.getByLabelText("Entregue de")).toHaveValue("2026-10-01");
    expect(screen.getByLabelText("Entregue até")).toHaveValue("2026-11-23");
  });

  it("Entregue em nunca abre em branco: Intervalo começa na última semana", async () => {
    const { sector, ana } = await seed();
    operator(sector.id, ana.id);
    await renderScreen({ visao: "tabela" });

    expect(screen.getByLabelText("Entregue em")).toHaveValue("all");
    await userEvent.selectOptions(
      screen.getByLabelText("Entregue em"),
      "range",
    );

    expect(screen.getByLabelText("Entregue de")).toHaveValue("2026-11-17");
    expect(screen.getByLabelText("Entregue até")).toHaveValue("2026-11-23");
  });

  it("?item= conhecido filtra; desconhecido ou de outro setor é ignorado", async () => {
    const { sector, other, ana, bia } = await seed();
    const rede = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rede",
      kind: "stock",
    });
    const alheio = await insertItem(db, {
      sectorId: other.id,
      name: "Item alheio",
      unit: "peça",
      kind: "stock",
    });
    const withRede = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Pede rede",
    });
    await insertRequestItem(db, { requestId: withRede.id, itemId: rede.id });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Sem item",
    });
    const foreign = await insertRequest(db, {
      sectorId: other.id,
      createdBy: bia.id,
      description: "Pede item alheio",
    });
    await insertRequestItem(db, { requestId: foreign.id, itemId: alheio.id });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela", item: rede.id });
    expect(screen.getByText("Pede rede")).toBeInTheDocument();
    expect(screen.queryByText("Sem item")).toBeNull();
    expect(screen.getByLabelText("Item")).toHaveValue(rede.id);
    expect(
      within(screen.getByLabelText("Item"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Todos os itens", "Rede de proteção (rede)"]);
    cleanup();

    await renderScreen({ visao: "tabela", item: alheio.id });
    expect(screen.getByText("Pede rede")).toBeInTheDocument();
    expect(screen.getByText("Sem item")).toBeInTheDocument();
    expect(screen.queryByText("Pede item alheio")).toBeNull();
    expect(screen.getByLabelText("Item")).toHaveValue("all");
    cleanup();

    await renderScreen({ visao: "tabela", item: NIL_ID });
    expect(screen.getByText("Sem item")).toBeInTheDocument();
    expect(screen.getByLabelText("Item")).toHaveValue("all");
  });

  it("sem nenhum item pedido no escopo não há seletor de Item", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Sem item",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela" });

    expect(screen.queryByLabelText("Item")).toBeNull();
  });

  it("?item= além do teto de escolhas continua aplicado e com a opção no seletor", async () => {
    const { sector, ana } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Pede muitos itens",
    });
    let lastId = "";
    for (let index = 0; index <= CHOICE_LIST_LIMIT; index += 1) {
      const entry = await insertItem(db, {
        sectorId: sector.id,
        name: `Item ${String(index).padStart(3, "0")}`,
        kind: "stock",
      });
      await insertRequestItem(db, { requestId: created.id, itemId: entry.id });
      lastId = entry.id;
    }
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Sem item nenhum",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "tabela", item: lastId });

    expect(screen.getByText("Pede muitos itens")).toBeInTheDocument();
    expect(screen.queryByText("Sem item nenhum")).toBeNull();
    expect(screen.getByLabelText("Item")).toHaveValue(lastId);
  }, 60_000);

  it("vazio com os filtros novos: texto de filtro e link para limpar que mantém a visão", async () => {
    const { sector, ana } = await seed();
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Solicitada",
    });
    operator(sector.id, ana.id);

    await renderScreen({ visao: "lista", status: "cancelada" });

    expect(
      screen.getByText("Nenhuma solicitação com esses filtros."),
    ).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", {
      name: "Limpar filtros",
    })) {
      expect(link).toHaveAttribute("href", "/solicitacoes?visao=lista");
    }
  });

  it("admin: o item vale no escopo escolhido (setor ou todos)", async () => {
    const { sector, other, ana, bia } = await seed();
    const mine = await insertItem(db, {
      sectorId: sector.id,
      name: "Item do setor",
      kind: "stock",
    });
    const theirs = await insertItem(db, {
      sectorId: other.id,
      name: "Item do outro",
      kind: "stock",
    });
    const first = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Pede o do setor",
    });
    await insertRequestItem(db, { requestId: first.id, itemId: mine.id });
    const second = await insertRequest(db, {
      sectorId: other.id,
      createdBy: bia.id,
      description: "Pede o do outro",
    });
    await insertRequestItem(db, { requestId: second.id, itemId: theirs.id });
    admin();

    await renderScreen({ visao: "tabela", setor: "todos", item: theirs.id });
    expect(screen.getByText("Pede o do outro")).toBeInTheDocument();
    expect(screen.queryByText("Pede o do setor")).toBeNull();
    cleanup();

    // Escolhido o setor ao lado, o item do outro setor não existe no escopo: ignorado.
    await renderScreen({ visao: "tabela", setor: sector.id, item: theirs.id });
    expect(screen.getByText("Pede o do setor")).toBeInTheDocument();
    expect(screen.getByLabelText("Item")).toHaveValue("all");
  });
});
