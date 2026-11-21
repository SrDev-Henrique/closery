import { render, screen } from "@testing-library/react";
import { use } from "react";
import { describe, expect, it, vi } from "vitest";

import DestinosPage from "./page";

vi.mock("@/components/admin/destinations/DestinationsAdmin", () => ({
  DestinationsAdmin: () => use(new Promise<never>(() => {})),
}));

describe("página /admin/destinos", () => {
  it("enquanto carrega mostra o esqueleto e nenhum título", () => {
    const { container } = render(
      <DestinosPage searchParams={Promise.resolve({})} />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
