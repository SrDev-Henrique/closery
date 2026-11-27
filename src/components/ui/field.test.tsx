import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldLabel } from "./field";

describe("FieldLabel — hover do rótulo com campo em accent (P83)", () => {
  it("o rótulo que envolve um campo usa bg-accent/50 no hover", () => {
    render(<FieldLabel>Rótulo</FieldLabel>);
    const label = screen.getByText("Rótulo");
    expect(label).toHaveAttribute("data-slot", "field-label");
    expect(label).toHaveClass(
      "has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-accent/50",
    );
    expect(label.className).not.toMatch(/bg-muted/);
  });
});
