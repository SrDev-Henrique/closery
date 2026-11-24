import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SummaryCorrection } from "@/features/handovers/summary";
import { spDate } from "../../../test/clock";
import { CorrectionsTimeline } from "./CorrectionsTimeline";

function correction(
  overrides: Partial<SummaryCorrection> = {},
): SummaryCorrection {
  return {
    id: "c-1",
    field: "item_quantity",
    itemName: "Rede de proteção",
    oldValue: "3",
    newValue: "5",
    reason: "Contagem errada",
    correctedByName: "Ana Teste",
    correctedAt: spDate("2026-11-21", "09:30"),
    ...overrides,
  };
}

describe("CorrectionsTimeline", () => {
  it("mostra campo, antigo → novo, motivo, quem e quando", () => {
    render(<CorrectionsTimeline corrections={[correction()]} />);

    const row = screen.getByRole("listitem");
    expect(
      within(row).getByText("Rede de proteção: quantidade"),
    ).toBeInTheDocument();
    expect(within(row).getByText("3 → 5")).toBeInTheDocument();
    expect(
      within(row).getByText("Motivo: Contagem errada"),
    ).toBeInTheDocument();
    expect(
      within(row).getByText("Ana Teste · 21/11/2026, 09:30"),
    ).toBeInTheDocument();
  });

  it("valor vazio aparece como (vazio)", () => {
    render(
      <CorrectionsTimeline
        corrections={[
          correction({
            field: "occurrences_text",
            itemName: null,
            oldValue: "",
            newValue: "Chuva forte",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Ocorrências do turno")).toBeInTheDocument();
    expect(screen.getByText("(vazio) → Chuva forte")).toBeInTheDocument();
  });

  it("usa o rótulo do texto do próximo turno e o da observação do item", () => {
    render(
      <CorrectionsTimeline
        corrections={[
          correction({
            id: "c-2",
            field: "next_shift_text",
            itemName: null,
            oldValue: "a",
            newValue: "b",
          }),
          correction({
            id: "c-3",
            field: "item_note",
            oldValue: "",
            newValue: "ok",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Fica para o próximo turno")).toBeInTheDocument();
    expect(
      screen.getByText("Rede de proteção: observação"),
    ).toBeInTheDocument();
  });

  it("é uma lista ordenada e mantém a ordem recebida", () => {
    render(
      <CorrectionsTimeline
        corrections={[
          correction({ id: "c-1", reason: "Primeira" }),
          correction({ id: "c-2", reason: "Segunda" }),
        ]}
      />,
    );

    const reasons = screen
      .getAllByRole("listitem")
      .map((row) => within(row).getByText(/^Motivo: /).textContent);
    expect(reasons).toEqual(["Motivo: Primeira", "Motivo: Segunda"]);
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("não escreve nada sem correções", () => {
    const { container } = render(<CorrectionsTimeline corrections={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
