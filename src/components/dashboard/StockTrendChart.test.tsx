import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockPoint } from "@/features/dashboard/types";
import { StockTrendChart } from "./StockTrendChart";

const POINTS: StockPoint[] = [
  { date: "2026-11-18", quantity: 40 },
  { date: "2026-11-19", quantity: null },
  { date: "2026-11-20", quantity: 1234 },
];

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error");
  warnSpy = vi.spyOn(console, "warn");
});
afterEach(() => {
  expect(errorSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

function mockReducedMotion(reduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe("StockTrendChart", () => {
  it("renderiza o gráfico e a tabela sr-only com um dia por linha, 'sem contagem' e a unidade no cabeçalho", () => {
    const { container } = render(
      <StockTrendChart label="Stretch" points={POINTS} unit="rolos" />,
    );
    expect(container.querySelector("[data-slot=chart]")).not.toBeNull();
    const table = screen.getByRole("table", { name: "Stretch por dia" });
    expect(table.className).toContain("sr-only");
    expect(
      within(table).getByRole("columnheader", { name: "Dia" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Contagem (rolos)" }),
    ).toBeInTheDocument();
    const rows = within(table).getAllByRole("row");
    // cabeçalho + 3 dias
    expect(rows).toHaveLength(4);
    expect(within(rows[1]).getByText("18/11/2026")).toBeInTheDocument();
    expect(within(rows[1]).getByText("40")).toBeInTheDocument();
    expect(within(rows[2]).getByText("sem contagem")).toBeInTheDocument();
    expect(within(rows[3]).getByText("1.234")).toBeInTheDocument();
  });

  it("a cor da série é o token foreground, nunca uma cor crua", () => {
    const { container } = render(
      <StockTrendChart label="Stretch" points={POINTS} unit="rolos" />,
    );
    expect(container.querySelector("style")?.textContent).toContain(
      "--color-quantity: var(--foreground)",
    );
  });

  it("movimento normal anima a linha; reduzido não", () => {
    mockReducedMotion(false);
    const normal = render(
      <StockTrendChart label="Stretch" points={POINTS} unit="rolos" />,
    );
    expect(normal.container.querySelector(".recharts-line")).not.toBeNull();
    normal.unmount();
    mockReducedMotion(true);
    const reduced = render(
      <StockTrendChart label="Stretch" points={POINTS} unit="rolos" />,
    );
    // Sem animação a curva já está inteira no primeiro render.
    expect(
      reduced.container.querySelector("path.recharts-line-curve"),
    ).not.toBeNull();
  });

  it("um dia só (período de 1 dia) renderiza", () => {
    const { container } = render(
      <StockTrendChart
        label="Stretch"
        points={[{ date: "2026-11-20", quantity: 7 }]}
        unit="rolos"
      />,
    );
    expect(container.querySelector("[data-slot=chart]")).not.toBeNull();
    expect(
      screen
        .getAllByRole("row")
        .filter((row) => row.textContent?.includes("7")),
    ).toHaveLength(1);
  });

  it("sem nenhuma contagem no período: texto de vazio, sem gráfico", () => {
    const { container } = render(
      <StockTrendChart
        label="Stretch"
        points={POINTS.map((point) => ({ ...point, quantity: null }))}
        unit="rolos"
      />,
    );
    expect(screen.getByText("Sem contagem no período.")).toBeInTheDocument();
    expect(container.querySelector("[data-slot=chart]")).toBeNull();
  });
});
