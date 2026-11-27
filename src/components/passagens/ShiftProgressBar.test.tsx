import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ShiftProgress } from "@/features/handovers/shiftProgress";
import { ShiftProgressBar } from "./ShiftProgressBar";

function progress(overrides: Partial<ShiftProgress> = {}): ShiftProgress {
  return {
    startLabel: "06:00",
    endLabel: "14:00",
    nowLabel: "08:42",
    pct: 34,
    ...overrides,
  };
}

function fillOf(bar: HTMLElement): HTMLElement {
  const fill = bar.firstElementChild;
  if (!(fill instanceof HTMLElement)) throw new Error("preenchimento ausente");
  return fill;
}

describe("ShiftProgressBar", () => {
  it("mostra início, 'agora HH:MM' e fim em mono, com tabular-nums", () => {
    render(<ShiftProgressBar progress={progress()} />);

    expect(screen.getByText("06:00")).toBeInTheDocument();
    expect(screen.getByText("agora 08:42")).toBeInTheDocument();
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText("agora 08:42").parentElement).toHaveClass(
      "font-mono",
      "tabular-nums",
    );
  });

  it("é uma progressbar com nome, valor e texto falado", () => {
    render(<ShiftProgressBar progress={progress({ pct: 33.6 })} />);

    const bar = screen.getByRole("progressbar", {
      name: "Progresso do turno",
    });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "34");
    expect(bar).toHaveAttribute("aria-valuetext", "Turno em 34%, agora 08:42");
  });

  it("o preenchimento tem a largura do pct, no trilho e na tinta dos pastéis", () => {
    render(<ShiftProgressBar progress={progress({ pct: 34 })} />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveClass("h-2.5", "rounded-full", "bg-on-pastel-track");
    expect(fillOf(bar)).toHaveClass("bg-on-pastel");
    expect(fillOf(bar)).toHaveStyle({ width: "34%" });
  });

  it.each([
    [0, "0%"],
    [100, "100%"],
    [-5, "0%"],
    [150, "100%"],
    [Number.NaN, "0%"],
  ])("limite: pct %s vira largura %s (preso entre 0 e 100)", (pct, width) => {
    render(<ShiftProgressBar progress={progress({ pct })} />);

    expect(fillOf(screen.getByRole("progressbar"))).toHaveStyle({ width });
  });

  it("usa só tokens de cor (sem hex nem classe crua)", () => {
    const { container } = render(<ShiftProgressBar progress={progress()} />);

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
    );
  });
});
