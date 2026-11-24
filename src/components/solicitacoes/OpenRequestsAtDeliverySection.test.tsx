import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OpenRequestsAtDelivery } from "@/features/requests/types";
import { spDate } from "../../../test/clock";
import { requestAtDelivery } from "../../../test/openRequests";
import { OpenRequestsAtDeliverySection } from "./OpenRequestsAtDeliverySection";

const DELIVERED_AT = spDate("2026-11-20", "14:05");

function data(
  overrides: Partial<OpenRequestsAtDelivery> = {},
): OpenRequestsAtDelivery {
  const rows = overrides.rows ?? [requestAtDelivery()];
  return {
    deliveredAt: DELIVERED_AT,
    rows,
    total: rows.length,
    staleCount: 0,
    ...overrides,
  };
}

function renderSection(
  props: Partial<Parameters<typeof OpenRequestsAtDeliverySection>[0]> = {},
) {
  render(
    <OpenRequestsAtDeliverySection
      data={data()}
      allHref="/solicitacoes"
      {...props}
    />,
  );
}

describe("OpenRequestsAtDeliverySection", () => {
  it("título e a descrição com a data e a hora da entrega, em São Paulo", () => {
    renderSection();

    expect(
      screen.getByRole("heading", { level: 2, name: "Solicitações abertas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Como estavam na entrega, em 20/11/2026 às 14:05."),
    ).toBeInTheDocument();
  });

  it("a data e a hora são de São Paulo mesmo depois da meia-noite UTC", () => {
    renderSection({
      data: data({ deliveredAt: spDate("2026-11-20", "23:30") }),
    });

    expect(
      screen.getByText("Como estavam na entrega, em 20/11/2026 às 23:30."),
    ).toBeInTheDocument();
  });

  it("mostra o status daquele instante e 'Agora: …' só quando mudou", () => {
    renderSection({
      data: data({
        rows: [
          requestAtDelivery({
            description: "Mudou depois",
            status: "requested",
            statusNow: "delivered",
          }),
          requestAtDelivery({
            description: "Não mudou",
            status: "in_transit",
            statusNow: "in_transit",
          }),
        ],
      }),
    });

    const [first, second] = within(screen.getByRole("list")).getAllByRole(
      "listitem",
    );
    expect(first).toHaveTextContent("Solicitada");
    expect(first).toHaveTextContent("Agora: Entregue");
    expect(second).toHaveTextContent("Em separação / Trânsito");
    expect(second).not.toHaveTextContent("Agora:");
  });

  it("o selo de parada é o do instante da entrega", () => {
    renderSection({
      data: data({
        rows: [requestAtDelivery({ stale: true, daysInStatus: 4 })],
        staleCount: 1,
      }),
    });

    expect(screen.getByText("Parada há 4 dias")).toBeInTheDocument();
  });

  it("sem abertas na entrega: 'Nenhuma solicitação aberta na entrega.'", () => {
    renderSection({ data: data({ rows: [], total: 0 }) });

    expect(
      screen.getByText("Nenhuma solicitação aberta na entrega."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("com mais de 20: 'Mostrando 20 de 25.'", () => {
    const rows = Array.from({ length: 20 }, () => requestAtDelivery());
    renderSection({ data: data({ rows, total: 25 }) });

    expect(screen.getByText("Mostrando 20 de 25.")).toBeInTheDocument();
  });

  it("'Ver todas as solicitações' usa o allHref e não há botão de criar", () => {
    renderSection({ allHref: "/solicitacoes?setor=abc" });

    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes?setor=abc");
    expect(
      screen.queryByRole("button", { name: "Nova solicitação" }),
    ).not.toBeInTheDocument();
  });
});
