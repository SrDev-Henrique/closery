import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { OpenRequestsNow } from "@/features/requests/types";
import { openRequest } from "../../../test/openRequests";
import { OpenRequestsNowSection } from "./OpenRequestsNowSection";

function data(overrides: Partial<OpenRequestsNow> = {}): OpenRequestsNow {
  const rows = overrides.rows ?? [openRequest()];
  return {
    rows,
    total: rows.length,
    staleCount: 0,
    ...overrides,
  };
}

function renderSection(
  props: Partial<Parameters<typeof OpenRequestsNowSection>[0]> = {},
) {
  render(
    <OpenRequestsNowSection
      data={data()}
      allHref="/solicitacoes"
      newRequest={null}
      {...props}
    />,
  );
}

describe("OpenRequestsNowSection", () => {
  it("título, descrição e as solicitações abertas na ordem recebida", () => {
    renderSection({
      data: data({
        rows: [
          openRequest({ description: "Primeira" }),
          openRequest({ description: "Segunda", status: "in_transit" }),
        ],
      }),
    });

    expect(
      screen.getByRole("heading", { level: 2, name: "Solicitações abertas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Do setor, agora. As paradas há mais tempo aparecem primeiro.",
      ),
    ).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Primeira");
    expect(items[1]).toHaveTextContent("Segunda");
    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("parada aparece com o selo", () => {
    renderSection({
      data: data({
        rows: [openRequest({ stale: true, daysInStatus: 4 })],
        staleCount: 1,
      }),
    });

    expect(screen.getByText("Parada há 4 dias")).toBeInTheDocument();
  });

  it("sem abertas: 'Nenhuma solicitação aberta.' e nenhuma lista", () => {
    renderSection({ data: data({ rows: [], total: 0 }) });

    expect(screen.getByText("Nenhuma solicitação aberta.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toBeInTheDocument();
  });

  it("com mais abertas do que as listadas: 'Mostrando 20 de 21.'", () => {
    const rows = Array.from({ length: 20 }, () => openRequest());
    renderSection({ data: data({ rows, total: 21 }) });

    expect(screen.getByText("Mostrando 20 de 21.")).toBeInTheDocument();
  });

  it("exatamente 20 abertas não mostra 'Mostrando'", () => {
    const rows = Array.from({ length: 20 }, () => openRequest());
    renderSection({ data: data({ rows, total: 20 }) });

    expect(screen.queryByText(/Mostrando/)).not.toBeInTheDocument();
  });

  it("'Ver todas as solicitações' usa o allHref (admin leva ?setor=)", () => {
    renderSection({ allHref: "/solicitacoes?setor=abc" });

    expect(
      screen.getByRole("link", { name: "Ver todas as solicitações" }),
    ).toHaveAttribute("href", "/solicitacoes?setor=abc");
  });

  it("mostra o nó de nova solicitação quando o recebe", () => {
    renderSection({
      newRequest: <button type="button">Nova solicitação</button>,
    });

    expect(
      screen.getByRole("button", { name: "Nova solicitação" }),
    ).toBeInTheDocument();
  });

  it("sem o nó de nova solicitação (null), não há botão", () => {
    renderSection({ newRequest: null });

    expect(
      screen.queryByRole("button", { name: "Nova solicitação" }),
    ).not.toBeInTheDocument();
  });
});
