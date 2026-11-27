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

  it("a linha inteira é clicável: o link é esticado (after:inset-0) e a linha mede 18px de raio", () => {
    const { container } = render(
      <ul>
        <OpenRequestItem request={openRequest()} />
      </ul>,
    );

    const row = container.querySelector('[data-slot="open-request-row"]');
    expect(row).toHaveClass("relative", "rounded-[18px]", "hover:bg-accent");
    expect(screen.getByRole("link")).toHaveClass(
      "after:absolute",
      "after:inset-0",
    );
    expect(container.querySelector("li")).toHaveClass("border-t");
  });

  it("o link mantém scroll={false} para abrir o detalhe rápido (href do detalhe, sem ?comentarios)", () => {
    renderItem({
      request: openRequest({ id: "22222222-2222-4222-8222-222222222222" }),
    });

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/solicitacoes/22222222-2222-4222-8222-222222222222",
    );
  });

  it("fecha com o chevron decorativo", () => {
    const { container } = render(
      <ul>
        <OpenRequestItem request={openRequest()} />
      </ul>,
    );

    const chevron = container.querySelector("svg.lucide-chevron-right");
    expect(chevron).not.toBeNull();
    expect(chevron).toHaveAttribute("aria-hidden", "true");
  });

  it("Solicitada usa o selo neutro e Em separação / Trânsito o azul, ambos com ícone", () => {
    const { container, rerender } = render(
      <ul>
        <OpenRequestItem request={openRequest({ status: "requested" })} />
      </ul>,
    );
    expect(screen.getByText("Solicitada")).toHaveClass("bg-accent");

    rerender(
      <ul>
        <OpenRequestItem request={openRequest({ status: "in_transit" })} />
      </ul>,
    );
    expect(screen.getByText("Em separação / Trânsito")).toHaveClass("bg-info");
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("nome de destino longo não estoura a linha (min-w-0 e quebra)", () => {
    const { container } = render(
      <ul>
        <OpenRequestItem
          request={openRequest({
            description: "x".repeat(60),
            destinationName: "Terminal ".repeat(20).trim(),
          })}
        />
      </ul>,
    );

    expect(
      container.querySelector('[data-slot="open-request-row"] > div'),
    ).toHaveClass("min-w-0", "flex-1");
  });
});
