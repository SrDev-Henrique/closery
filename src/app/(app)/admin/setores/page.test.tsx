import { render, screen } from "@testing-library/react";
import { use } from "react";
import { describe, expect, it, vi } from "vitest";

import SetoresPage from "./page";

// A tela nunca resolve: o que a página mostra enquanto espera é o esqueleto,
// sem título (o <h1> só existe depois do portão).
vi.mock("@/components/admin/sectors/SectorsAdmin", () => ({
  SectorsAdmin: () => use(new Promise<never>(() => {})),
}));

describe("página /admin/setores", () => {
  it("enquanto carrega mostra o esqueleto e nenhum título", () => {
    const { container } = render(
      <SetoresPage searchParams={Promise.resolve({})} />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
