import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("usa bg-accent: o bg-muted é igual ao card na paleta nova e o esqueleto sumia dentro dos cards e do Sheet", () => {
    const { container } = render(<Skeleton className="h-4" />);
    const block = container.querySelector("[data-slot=skeleton]");
    expect(block).toHaveClass("bg-accent", "animate-pulse", "h-4");
    expect(block).not.toHaveClass("bg-muted");
  });

  it("quem precisa de outro fundo troca pelo className (o Início usa bg-card)", () => {
    const { container } = render(<Skeleton className="bg-card" />);
    const block = container.querySelector("[data-slot=skeleton]");
    expect(block).toHaveClass("bg-card");
    expect(block).not.toHaveClass("bg-accent");
  });
});
