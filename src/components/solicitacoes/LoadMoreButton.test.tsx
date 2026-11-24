import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoadMoreButton } from "./LoadMoreButton";

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

describe("LoadMoreButton", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
  });

  it("mostra o botão e quantas linhas já aparecem", () => {
    render(
      <LoadMoreButton
        href="/solicitacoes?mais_solicitada=40"
        shown={20}
        total={45}
      />,
    );

    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeEnabled();
    expect(screen.getByText("20 de 45")).toBeInTheDocument();
  });

  it("clicar troca a URL sem rolar a página", async () => {
    render(
      <LoadMoreButton
        href="/solicitacoes?mais_solicitada=40"
        shown={20}
        total={45}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Carregar mais" }),
    );

    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith(
      "/solicitacoes?mais_solicitada=40",
      { scroll: false },
    );
  });

  it("o contador fica numa região aria-live", () => {
    render(
      <LoadMoreButton
        href="/solicitacoes?mais_entregue=40"
        shown={1}
        total={1}
      />,
    );

    const counter = screen.getByText("1 de 1");
    expect(counter).toHaveAttribute("aria-live", "polite");
    expect(counter.className).toContain("tabular-nums");
  });
});
