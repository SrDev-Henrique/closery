import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageSkeleton } from "@/components/app-shell/PageSkeleton";

describe("PageSkeleton", () => {
  it("fica escondido de leitores de tela e não tem texto nem links", () => {
    const { container } = render(<PageSkeleton />);
    const root = container.firstElementChild;

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveTextContent("");
    expect(container.querySelector("a, button")).toBeNull();
  });
});
