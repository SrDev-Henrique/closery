import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryRow } from "@/features/handovers/history";
import { spDate } from "../../../test/clock";
import { HistoryRowItem } from "./HistoryRowItem";

const SECTOR = "22222222-2222-4222-8222-222222222222";
const SHIFT = "33333333-3333-4333-8333-333333333333";
const HANDOVER = "44444444-4444-4444-8444-444444444444";

function row(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    key: `${SECTOR}:${SHIFT}:2026-11-20`,
    operationalDate: "2026-11-20",
    shiftId: SHIFT,
    shiftName: "Turno Manhã",
    sectorId: SECTOR,
    sectorName: "Setor Teste",
    handoverId: HANDOVER,
    situation: "confirmed",
    corrected: false,
    hasDraft: false,
    deliveredByName: "Ana Teste",
    deliveredAt: spDate("2026-11-20", "14:05"),
    confirmedByName: "Bia Teste",
    confirmedAt: spDate("2026-11-20", "14:20"),
    ...overrides,
  };
}

function renderRow(props: Parameters<typeof HistoryRowItem>[0]) {
  render(
    <ul>
      <HistoryRowItem {...props} />
    </ul>,
  );
}

describe("HistoryRowItem", () => {
  it("confirmada: dia, turno, quem entregou, selo com o nome e link Abrir", () => {
    renderRow({ row: row(), showSector: false, sectorParam: null });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("20/11/2026 · Turno Manhã");
    expect(item).toHaveTextContent("Entregue por Ana Teste às 14:05");
    expect(item).toHaveTextContent("Confirmada por Bia Teste");
    expect(item).not.toHaveTextContent("Corrigida");
    expect(item).not.toHaveTextContent("Setor Teste");
    expect(
      screen.getByRole("link", {
        name: "Abrir passagem de Turno Manhã em 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/${HANDOVER}`);
  });

  it("corrigida: o selo 'Corrigida' aparece ao lado da situação", () => {
    renderRow({
      row: row({ corrected: true }),
      showSector: false,
      sectorParam: null,
    });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Confirmada por Bia Teste");
    expect(item).toHaveTextContent("Corrigida");
  });

  it("aguardando e não confirmada mostram o texto da situação (nunca só cor)", () => {
    renderRow({
      row: row({
        situation: "awaiting",
        confirmedByName: null,
        confirmedAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });
    expect(screen.getByText("Aguardando recebimento")).toBeInTheDocument();
  });

  it("não confirmada", () => {
    renderRow({
      row: row({
        situation: "unconfirmed",
        confirmedByName: null,
        confirmedAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });
    expect(screen.getByText("Não confirmada")).toBeInTheDocument();
  });

  it("admin em 'Todos os setores' vê o setor na linha", () => {
    renderRow({ row: row(), showSector: true, sectorParam: "todos" });
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Setor Teste · Entregue por Ana Teste às 14:05",
    );
  });

  it("sem passagem: sem 'Entregue por' e com o link 'Entregar turno' para aquele turno e dia", () => {
    renderRow({
      row: row({
        handoverId: null,
        situation: "missing",
        deliveredByName: null,
        deliveredAt: null,
        confirmedByName: null,
        confirmedAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Sem passagem");
    expect(item).not.toHaveTextContent("Entregue por");
    expect(
      screen.getByRole("link", {
        name: "Entregar turno de Turno Manhã em 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/nova?turno=${SHIFT}&data=2026-11-20`);
    expect(
      screen.queryByRole("link", { name: /Abrir/ }),
    ).not.toBeInTheDocument();
  });

  it("sem passagem para o admin: o link leva o setor da linha, não 'todos'", () => {
    renderRow({
      row: row({ handoverId: null, situation: "missing", deliveredAt: null }),
      showSector: true,
      sectorParam: "todos",
    });
    expect(
      screen.getByRole("link", { name: /Entregar turno/ }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT}&data=2026-11-20&setor=${SECTOR}`,
    );
  });

  it("sem passagem com rascunho: o link é 'Continuar passagem'", () => {
    renderRow({
      row: row({
        handoverId: null,
        situation: "missing",
        hasDraft: true,
        deliveredByName: null,
        deliveredAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });

    expect(
      screen.getByRole("link", {
        name: "Continuar passagem de Turno Manhã em 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/nova?turno=${SHIFT}&data=2026-11-20`);
    expect(
      screen.queryByRole("link", { name: /Entregar turno/ }),
    ).not.toBeInTheDocument();
  });
});
