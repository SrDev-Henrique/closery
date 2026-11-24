import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { openRequest } from "../../../test/openRequests";
import { OpenRequestItem } from "./OpenRequestItem";

function renderItem(props: Parameters<typeof OpenRequestItem>[0]) {
  render(
    <ul>
      <OpenRequestItem {...props} />
    </ul>,
  );
}

describe("OpenRequestItem", () => {
  it("mostra a descrição como link do detalhe, o destino e o status com ícone e texto", () => {
    const request = openRequest({
      id: "11111111-1111-4111-8111-111111111111",
      description: "Trocar redes do box 4",
      destinationName: "Doca 3",
      status: "in_transit",
    });

    renderItem({ request });

    const link = screen.getByRole("link", { name: "Trocar redes do box 4" });
    expect(link).toHaveAttribute(
      "href",
      "/solicitacoes/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByText("Para Doca 3")).toBeInTheDocument();
    expect(screen.getByText("Em separação / Trânsito")).toBeInTheDocument();
    expect(screen.queryByText(/Parada há/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Agora:/)).not.toBeInTheDocument();
  });

  it("descrição longa vira a prévia de 60 pontos de código; só a primeira linha", () => {
    const long = "A".repeat(80);
    renderItem({ request: openRequest({ description: `${long}\nsegunda` }) });

    expect(screen.getByRole("link")).toHaveTextContent(`${"A".repeat(59)}…`);
    expect(screen.queryByText(/segunda/)).not.toBeInTheDocument();
  });

  it("parada mostra o selo com os dias e o singular de 1 dia", () => {
    renderItem({ request: openRequest({ stale: true, daysInStatus: 1 }) });

    expect(screen.getByText("Parada há 1 dia")).toBeInTheDocument();
  });

  it("parada há vários dias usa o plural", () => {
    renderItem({ request: openRequest({ stale: true, daysInStatus: 5 }) });

    expect(screen.getByText("Parada há 5 dias")).toBeInTheDocument();
  });

  it("statusNow diferente do status mostra 'Agora: {status}'", () => {
    renderItem({
      request: openRequest({ status: "requested" }),
      statusNow: "delivered",
    });

    expect(screen.getByText("Solicitada")).toBeInTheDocument();
    expect(screen.getByText("Agora: Entregue")).toBeInTheDocument();
  });

  it("statusNow igual ao status não repete nada", () => {
    renderItem({
      request: openRequest({ status: "in_transit" }),
      statusNow: "in_transit",
    });

    expect(screen.queryByText(/Agora:/)).not.toBeInTheDocument();
  });

  it("destino de texto livre (Outro) aparece como veio", () => {
    renderItem({ request: openRequest({ destinationName: "Hangar 2 — 🚚" }) });

    expect(screen.getByText("Para Hangar 2 — 🚚")).toBeInTheDocument();
  });
});
