import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Authz } from "@/features/authz/authz";
import type { DashboardScope, RequestsData } from "@/features/dashboard/types";
import { DashboardRequests } from "./DashboardRequests";

// Os tetos (8 destinos e 12 itens) são do SQL e se provam na Tarefa 9; aqui só
// o texto que o bloco escreve quando o servidor diz que há mais.
const mocks = vi.hoisted(() => ({ getRequestsData: vi.fn() }));

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/dashboard/requests", () => ({
  getRequestsData: mocks.getRequestsData,
}));

const ACTOR: Authz = {
  userId: "user-admin",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

function scope(overrides: Partial<DashboardScope> = {}): DashboardScope {
  return {
    sectorId: null,
    sectorName: null,
    sectorParam: "todos",
    showSector: true,
    period: { period: "7", from: "2026-11-14", to: "2026-11-20" },
    previous: { from: "2026-11-07", to: "2026-11-13" },
    days: 7,
    today: "2026-11-20",
    ...overrides,
  };
}

function data(): RequestsData {
  return {
    open: 0,
    stale: 0,
    deliveredInPeriod: 0,
    destinations: Array.from({ length: 8 }, (_, index) => ({
      key: `destino-${index}`,
      destinationId: `destino-${index}`,
      name: `Destino ${index + 1}`,
      deliveredCount: 1,
      averageSeconds: 3600 - index,
    })),
    totalDestinations: 11,
    items: Array.from({ length: 12 }, (_, index) => ({
      itemId: `item-${index}`,
      sectorId: "setor",
      sectorName: "ULD Teste",
      name: `Item ${index + 1}`,
      unit: "peça",
      quantity: 10 - index,
      requestCount: 1,
    })),
    totalItems: 15,
  };
}

describe("DashboardRequests: tetos", () => {
  beforeEach(() => {
    mocks.getRequestsData.mockReset();
    mocks.getRequestsData.mockResolvedValue(data());
  });

  it("mostra quantos destinos e itens existem além do teto; em Todos os setores sugere escolher um setor", async () => {
    render(
      await DashboardRequests({
        actor: ACTOR,
        scope: scope(),
        now: new Date("2026-11-20T18:00:00Z"),
      }),
    );

    const region = screen.getByRole("region", { name: "Solicitações" });
    expect(
      within(region).getByText("Mostrando 8 de 11 destinos."),
    ).toBeInTheDocument();
    expect(
      within(region).getByText(
        "Mostrando 12 de 15 itens. Escolha um setor para ver todos.",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        within(region).getByRole("list", {
          name: "Quantidade pedida por item",
        }),
      ).getAllByRole("link"),
    ).toHaveLength(12);
  });

  it("com um setor escolhido, o aviso de itens não sugere nada", async () => {
    render(
      await DashboardRequests({
        actor: ACTOR,
        scope: scope({
          sectorId: "setor",
          sectorName: "ULD Teste",
          sectorParam: "setor",
          showSector: false,
        }),
        now: new Date("2026-11-20T18:00:00Z"),
      }),
    );

    expect(screen.getByText("Mostrando 12 de 15 itens.")).toBeInTheDocument();
  });

  it("no teto exato não escreve aviso nenhum", async () => {
    mocks.getRequestsData.mockResolvedValue({
      ...data(),
      totalDestinations: 8,
      totalItems: 12,
    });

    render(
      await DashboardRequests({
        actor: ACTOR,
        scope: scope(),
        now: new Date("2026-11-20T18:00:00Z"),
      }),
    );

    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });
});
