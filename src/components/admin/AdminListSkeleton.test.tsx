import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminListSkeleton } from "./AdminListSkeleton";

describe("AdminListSkeleton", () => {
  it("mostra 4 linhas por padrão e avisa que está ocupado", () => {
    render(<AdminListSkeleton />);

    const list = screen.getByRole("list", { name: "Carregando" });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("respeita a quantidade pedida", () => {
    render(<AdminListSkeleton rows={2} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("com zero linhas não renderiza itens", () => {
    render(<AdminListSkeleton rows={0} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
