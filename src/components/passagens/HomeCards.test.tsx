import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  HomeHandovers as HomeHandoversData,
  MyShiftState,
  PendingHandover,
} from "@/features/handovers/home";
import type { HomeRequests } from "@/features/requests/types";
import { spDate } from "../../../test/clock";
import { HomeCards } from "./HomeCards";

vi.mock("@/app/(app)/actions", () => ({
  dismissInviteCardAction: vi.fn(),
  chooseSectorAction: vi.fn(),
}));
vi.mock("@/lib/avatar", () => ({
  avatarDataUri: (seed: string) => `data:image/svg+xml,${seed}`,
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const SHIFT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Turno Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
};
const REF = {
  sectorId: SECTOR_ID,
  shiftId: SHIFT.id,
  operationalDate: "2026-11-20",
};
const START: MyShiftState = {
  kind: "start",
  ref: REF,
  shift: SHIFT,
  saved: null,
  progress: {
    startLabel: "06:00",
    endLabel: "14:00",
    nowLabel: "08:42",
    pct: 34,
  },
};
const PENDING: PendingHandover = {
  id: "h1",
  sectorName: "ULD",
  shiftName: "Turno Noite",
  operationalDate: "2026-11-19",
  deliveredByName: "Bruno Teste",
  deliveredById: "u-bruno",
  deliveredAt: spDate("2026-11-19", "05:58"),
  nextShiftPreview: "Conferir a rede do box 4.",
};
const NO_REQUESTS: HomeRequests = { openCount: 0, staleCount: 0, stale: [] };
const INVITE = { sectors: 4, shifts: 12, items: 9, destinations: 5, people: 1 };

function home(overrides: Partial<HomeHandoversData> = {}): HomeHandoversData {
  return {
    sector: { id: SECTOR_ID, name: "ULD", color: "lilac" },
    pending: null,
    mine: START,
    ...overrides,
  };
}

type Props = Parameters<typeof HomeCards>[0];

function renderCards(overrides: Partial<Props> = {}) {
  return render(
    <HomeCards
      home={home()}
      requests={NO_REQUESTS}
      sectorParam={null}
      canManageCatalog={false}
      actorId="u-ana"
      inviteCounts={null}
      firstAccess={false}
      {...overrides}
    />,
  );
}

function titles(): (string | null)[] {
  return screen
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

describe("HomeCards", () => {
  it("só turno e solicitações: nada de pendente nem convite", () => {
    const { container } = renderCards();

    expect(titles()).toEqual(["Passagem do meu turno", "Solicitações"]);
    // O ponto de extensão da Task 11 continua com o mesmo nome e o gap de 16px.
    expect(container.firstElementChild).toHaveAttribute(
      "data-slot",
      "home-cards",
    );
    expect(container.firstElementChild).toHaveClass(
      "flex",
      "flex-col",
      "gap-4",
    );
  });

  it("turno e solicitações lado a lado em 1.3fr/1fr só a partir de 1040px de área útil", () => {
    renderCards();

    const grid = screen
      .getByRole("heading", { name: "Passagem do meu turno" })
      .closest(".grid");
    expect(grid).toHaveClass(
      "grid-cols-[minmax(0,1fr)]",
      "items-stretch",
      "gap-4",
      "@min-[1040px]/main:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]",
    );
    expect(grid).toContainElement(
      screen.getByRole("heading", { name: "Solicitações" }),
    );
  });

  it("com pendente, ele vem antes do turno e usa o avatar de quem entregou", () => {
    const { container } = renderCards({ home: home({ pending: PENDING }) });

    expect(titles()).toEqual([
      "Passagem para confirmar",
      "Passagem do meu turno",
      "Solicitações",
    ]);
    expect(
      container.querySelector('img[src="data:image/svg+xml,u-bruno"]'),
    ).not.toBeNull();
  });

  it("com convite, ele vem no topo, antes do pendente, com o avatar do admin", () => {
    const { container } = renderCards({
      home: home({ pending: PENDING }),
      inviteCounts: INVITE,
      actorId: "u-admin",
    });

    expect(titles()).toEqual([
      "Convide sua equipe",
      "Passagem para confirmar",
      "Passagem do meu turno",
      "Solicitações",
    ]);
    expect(
      container.querySelector('img[src="data:image/svg+xml,u-admin"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Agora não" }),
    ).toBeInTheDocument();
  });

  it("sem convite (operador, dispensado ou equipe maior), nenhum 'Agora não' na tela", () => {
    renderCards({ inviteCounts: null });

    expect(
      screen.queryByRole("heading", { name: "Convide sua equipe" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agora não" }),
    ).not.toBeInTheDocument();
  });

  it("no primeiro acesso o cartão de solicitações vazio ganha a linha de apoio, com o avatar de quem está logado", () => {
    const { container } = renderCards({
      firstAccess: true,
      inviteCounts: INVITE,
      actorId: "u-admin",
    });

    const requests = screen
      .getByRole("heading", { name: "Solicitações" })
      .closest('[data-slot="card"]') as HTMLElement;
    expect(
      within(requests).getByText(
        "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.",
      ),
    ).toBeInTheDocument();
    expect(requests.querySelector("img")).toHaveAttribute(
      "src",
      "data:image/svg+xml,u-admin",
    );
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(2);
  });

  it("dispensado (inviteCounts nulo) mas ainda no primeiro acesso: a linha de apoio continua", () => {
    renderCards({ firstAccess: true, inviteCounts: null });

    expect(
      screen.getByText(
        "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Convide sua equipe" }),
    ).not.toBeInTheDocument();
  });

  it("rascunho: o avatar de quem salvou usa o id dessa pessoa", () => {
    const { container } = renderCards({
      home: home({
        mine: {
          ...START,
          kind: "continue",
          saved: {
            at: spDate("2026-11-20", "07:58"),
            byName: "Carla Teste",
            byId: "u-carla",
          },
        },
      }),
    });

    expect(
      container.querySelector('img[src="data:image/svg+xml,u-carla"]'),
    ).not.toBeNull();
  });

  it("admin leva o setor nos links (começar passagem e ver solicitações)", () => {
    renderCards({ sectorParam: SECTOR_ID, canManageCatalog: true });

    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20&setor=${SECTOR_ID}`,
    );
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", `/solicitacoes?setor=${SECTOR_ID}`);
  });
});
