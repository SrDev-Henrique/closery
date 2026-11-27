import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PendingHandover } from "@/features/handovers/home";
import { spDate } from "../../../test/clock";
import { PendingHandoverCard } from "./PendingHandoverCard";

function pending(overrides: Partial<PendingHandover> = {}): PendingHandover {
  return {
    id: "h1",
    sectorName: "ULD",
    shiftName: "Turno Manhã",
    operationalDate: "2026-11-20",
    deliveredById: "u-ana",
    deliveredByName: "Ana Teste",
    deliveredAt: spDate("2026-11-20", "14:05"),
    nextShiftPreview: "Rede de proteção no box 4.",
    ...overrides,
  };
}

describe("PendingHandoverCard", () => {
  it("mostra título, turno e data, quem entregou e o que fica para o próximo turno", () => {
    render(<PendingHandoverCard pending={pending()} />);

    expect(
      screen.getByRole("heading", { name: "Passagem para confirmar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Turno Manhã · 20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Entregue às 14:05 por Ana Teste"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fica para o próximo turno")).toBeInTheDocument();
    expect(screen.getByText("Rede de proteção no box 4.")).toBeInTheDocument();
  });

  it("sem texto para o próximo turno, avisa que nada foi registrado", () => {
    render(
      <PendingHandoverCard pending={pending({ nextShiftPreview: null })} />,
    );

    expect(
      screen.getByText("Nada registrado para o próximo turno."),
    ).toBeInTheDocument();
  });

  it("'Ver passagem' é link para o resumo da passagem", () => {
    render(<PendingHandoverCard pending={pending({ id: "abc" })} />);

    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/abc",
    );
  });

  it("não tem botão de confirmar (a confirmação é no resumo)", () => {
    render(<PendingHandoverCard pending={pending()} />);

    expect(
      screen.queryByRole("button", { name: "Confirmar recebimento" }),
    ).not.toBeInTheDocument();
  });
});
