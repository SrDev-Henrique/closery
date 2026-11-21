import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InactiveBadge } from "./InactiveBadge";

describe("InactiveBadge", () => {
  it("mostra o texto 'Inativo' (nunca só cor)", () => {
    render(<InactiveBadge />);
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });
});
