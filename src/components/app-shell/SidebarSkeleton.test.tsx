import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";

describe("SidebarSkeleton", () => {
  it("fica escondido de leitores de tela e não tem texto nem links", () => {
    const { container } = render(<SidebarSkeleton />);
    const root = container.firstElementChild;

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveTextContent("");
    expect(container.querySelector("a, button")).toBeNull();
  });

  it("só aparece no desktop (no celular a barra é uma gaveta)", () => {
    const { container } = render(<SidebarSkeleton />);
    const classes = (container.firstElementChild?.className ?? "").split(" ");

    expect(classes).toContain("hidden");
    expect(classes).toContain("md:flex");
  });

  it("tem a forma nova: wordmark, grupo de navegação e card do usuário, sem borda", () => {
    const { container } = render(<SidebarSkeleton />);
    const root = container.firstElementChild as HTMLElement;
    const classes = root.className.split(" ");

    expect(classes).toContain("bg-sidebar");
    expect(classes).not.toContain("border-r");
    expect(root.children).toHaveLength(3);
    expect((root.children[1] as HTMLElement).className).toContain(
      "rounded-[28px]",
    );
    expect((root.children[2] as HTMLElement).className).toContain(
      "rounded-[24px]",
    );
  });
});
