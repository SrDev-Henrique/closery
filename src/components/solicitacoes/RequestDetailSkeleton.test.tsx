import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequestDetailSkeleton } from "./RequestDetailSkeleton";

describe("RequestDetailSkeleton", () => {
  it("marca a região como ocupada e desenha blocos com o formato do detalhe", () => {
    const { container } = render(<RequestDetailSkeleton />);

    expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
    expect(
      container.querySelectorAll("[data-slot='skeleton']").length,
    ).toBeGreaterThanOrEqual(5);
  });
});
