import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Activity } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SheetTitle } from "@/components/ui/sheet";
import { RequestSheet } from "./RequestSheet";

const mocks = vi.hoisted(() => ({ back: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: mocks.back }),
}));

function setup() {
  return render(
    <RequestSheet>
      <SheetTitle>Solicitação para Doca 3</SheetTitle>
      <p>Conteúdo do detalhe</p>
    </RequestSheet>,
  );
}

describe("RequestSheet", () => {
  beforeEach(() => {
    mocks.back.mockReset();
  });

  it("abre sempre (open constante) com o conteúdo dentro de um dialog", () => {
    setup();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Conteúdo do detalhe");
    expect(
      screen.getByRole("heading", { name: "Solicitação para Doca 3" }),
    ).toBeInTheDocument();
  });

  it("ocupa a largura toda no celular: o w-3/4 do Sheet deixava o botão de mudar status cortado na borda em 390px", () => {
    setup();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("data-[side=right]:w-full");
    expect(dialog).not.toHaveClass("data-[side=right]:w-3/4");
  });

  it("o botão de fechar tem texto e é o único (sem o X só com ícone)", () => {
    setup();

    const close = screen.getByRole("button", { name: "Fechar" });
    expect(close).toHaveTextContent("Fechar");
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(close.className).toContain("max-md:h-11");
  });

  it("Escape volta no histórico", async () => {
    setup();

    await userEvent.keyboard("{Escape}");

    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("Fechar volta no histórico", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("Escape duas vezes seguidas volta uma vez só", async () => {
    setup();

    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Escape}");

    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("Escape e depois Fechar volta uma vez só", async () => {
    setup();

    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(mocks.back).toHaveBeenCalledTimes(1);
  });

  it("a Activity esconde e revela a mesma instância: a trava é liberada", async () => {
    const tree = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <RequestSheet>
          <SheetTitle>Solicitação para Doca 3</SheetTitle>
          <p>Conteúdo do detalhe</p>
        </RequestSheet>
      </Activity>
    );
    const { rerender } = render(tree("visible"));
    await userEvent.keyboard("{Escape}");
    expect(mocks.back).toHaveBeenCalledTimes(1);

    rerender(tree("hidden"));
    rerender(tree("visible"));
    await userEvent.keyboard("{Escape}");

    expect(mocks.back).toHaveBeenCalledTimes(2);
  });
});
