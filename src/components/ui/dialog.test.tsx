import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DialogFooter } from "./dialog";

describe("DialogFooter — rodapé em accent (P83)", () => {
  it("se separa do corpo com bg-accent/50 (o popover tem o valor do card)", () => {
    render(<DialogFooter>Ações</DialogFooter>);
    const footer = screen.getByText("Ações");
    expect(footer).toHaveAttribute("data-slot", "dialog-footer");
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer.className).not.toMatch(/bg-muted/);
  });
});
