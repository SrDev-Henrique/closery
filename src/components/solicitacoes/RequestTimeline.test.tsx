import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RequestTimelineEntry } from "@/features/requests/types";
import { RequestTimeline } from "./RequestTimeline";

function entry(
  overrides: Partial<RequestTimelineEntry> & Pick<RequestTimelineEntry, "id">,
): RequestTimelineEntry {
  return {
    kind: "moved",
    from: "requested",
    to: "in_transit",
    byName: "Ana Teste",
    at: new Date("2026-11-20T12:00:00Z"),
    reason: null,
    ...overrides,
  };
}

describe("RequestTimeline", () => {
  it("mostra as quatro frases, na ordem recebida", () => {
    render(
      <RequestTimeline
        entries={[
          entry({ id: "1", kind: "created", from: null, to: "requested" }),
          entry({
            id: "2",
            kind: "moved",
            to: "in_transit",
            byName: "Bia Teste",
          }),
          entry({
            id: "3",
            kind: "cancelled",
            to: "cancelled",
            reason: "Pedido duplicado",
          }),
          entry({
            id: "4",
            kind: "reopened",
            from: "cancelled",
            to: "requested",
          }),
        ]}
      />,
    );

    expect(
      screen
        .getAllByRole("listitem")
        .map((item) => item.querySelector("p")?.textContent),
    ).toEqual([
      "Criada por Ana Teste",
      "Bia Teste moveu para Em separação / Trânsito",
      "Ana Teste cancelou",
      "Ana Teste reabriu como Solicitada",
    ]);
  });

  it("mostra data e hora de São Paulo", () => {
    render(<RequestTimeline entries={[entry({ id: "1" })]} />);

    expect(screen.getByText("20/11/2026, 09:00")).toBeInTheDocument();
  });

  it("o motivo do cancelamento aparece junto do 'cancelou'", () => {
    render(
      <RequestTimeline
        entries={[
          entry({
            id: "1",
            kind: "cancelled",
            to: "cancelled",
            reason: "Pedido duplicado",
          }),
        ]}
      />,
    );

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Ana Teste cancelou")).toBeInTheDocument();
    expect(
      within(item).getByText("Motivo: Pedido duplicado"),
    ).toBeInTheDocument();
  });

  it("sem motivo não há linha de motivo", () => {
    render(<RequestTimeline entries={[entry({ id: "1" })]} />);

    expect(screen.queryByText(/^Motivo:/)).toBeNull();
  });

  it("cada evento usa o ícone do status de destino (não só cor)", () => {
    render(
      <RequestTimeline
        entries={[
          entry({ id: "1", to: "delivered" }),
          entry({ id: "2", to: "cancelled", kind: "cancelled" }),
        ]}
      />,
    );

    for (const item of screen.getAllByRole("listitem")) {
      expect(item.querySelector("svg")).not.toBeNull();
    }
  });

  it("sem eventos a lista fica vazia", () => {
    render(<RequestTimeline entries={[]} />);

    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
