import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DashboardBlockSkeleton,
  DashboardSkeleton,
} from "./DashboardBlockSkeleton";

describe("DashboardBlockSkeleton", () => {
  it("marca o bloco como ocupado, mostra o título e nenhum dígito (nunca zero)", () => {
    const { container } = render(<DashboardBlockSkeleton title="Controles" />);

    expect(screen.getByRole("region", { name: "Controles" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Controles" }),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\d/);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length,
    ).toBeGreaterThan(0);
  });
});

describe("DashboardSkeleton", () => {
  it("é o fallback da página: título, período, seletor e os quatro blocos, sem número", () => {
    const { container } = render(<DashboardSkeleton />);

    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(titles).toEqual([
      "Passagens",
      "Controles",
      "Estoque",
      "Solicitações",
    ]);
    expect(container.querySelectorAll('[aria-busy="true"]')).toHaveLength(4);
    expect(container.textContent).not.toMatch(/\d/);
  });
});
