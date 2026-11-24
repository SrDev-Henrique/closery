import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HomeRequests } from "@/features/requests/types";
import { openRequest } from "../../../test/openRequests";
import { RequestsHomeCard } from "./RequestsHomeCard";

function home(overrides: Partial<HomeRequests> = {}): HomeRequests {
  return { openCount: 0, staleCount: 0, stale: [], ...overrides };
}

function renderCard(
  props: Partial<Parameters<typeof RequestsHomeCard>[0]> = {},
) {
  render(<RequestsHomeCard home={home()} allHref="/solicitacoes" {...props} />);
}

describe("RequestsHomeCard", () => {
  it("o título é um h2 'Solicitações'", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { level: 2, name: "Solicitações" }),
    ).toBeInTheDocument();
  });

  it("sem abertas: 'Nenhuma solicitação aberta.' e o link", () => {
    renderCard();

    expect(screen.getByText("Nenhuma solicitação aberta.")).toBeInTheDocument();
    expect(screen.queryByText(/ · /)).not.toBeInTheDocument();
    expect(screen.queryByText("Paradas há mais tempo")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes");
  });

  it("singular: '1 aberta · 0 paradas' e sem a lista de paradas", () => {
    renderCard({ home: home({ openCount: 1, staleCount: 0 }) });

    expect(screen.getByText("1 aberta · 0 paradas")).toBeInTheDocument();
    expect(screen.queryByText("Paradas há mais tempo")).not.toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("plural: '7 abertas · 2 paradas' e as paradas listadas com link", () => {
    renderCard({
      home: home({
        openCount: 7,
        staleCount: 2,
        stale: [
          openRequest({
            description: "Mais antiga",
            stale: true,
            daysInStatus: 6,
          }),
          openRequest({ description: "Parada", stale: true, daysInStatus: 4 }),
        ],
      }),
    });

    expect(screen.getByText("7 abertas · 2 paradas")).toBeInTheDocument();
    expect(screen.getByText("Paradas há mais tempo")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Mais antiga");
    expect(items[0]).toHaveTextContent("Parada há 6 dias");
    expect(
      within(items[1] as HTMLElement).getByRole("link", { name: "Parada" }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/solicitacoes\/.+/));
  });

  it("uma parada: '3 abertas · 1 parada'", () => {
    renderCard({
      home: home({
        openCount: 3,
        staleCount: 1,
        stale: [openRequest({ stale: true, daysInStatus: 3 })],
      }),
    });

    expect(screen.getByText("3 abertas · 1 parada")).toBeInTheDocument();
  });

  it("o link usa o allHref (admin leva ?setor=)", () => {
    renderCard({ allHref: "/solicitacoes?setor=abc" });

    expect(
      screen.getByRole("link", { name: "Ver solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes?setor=abc");
  });
});
