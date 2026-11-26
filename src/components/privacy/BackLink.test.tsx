import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BackLink } from "./BackLink";

const mocks = vi.hoisted(() => ({ router: { back: vi.fn(), push: vi.fn() } }));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

function setHistoryLength(length: number) {
  vi.spyOn(window.history, "length", "get").mockReturnValue(length);
}

beforeEach(() => {
  mocks.router.back.mockReset();
  mocks.router.push.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackLink", () => {
  it("volta para a página anterior quando há histórico", async () => {
    setHistoryLength(3);
    render(<BackLink />);
    await userEvent.click(screen.getByRole("link", { name: "Voltar" }));
    expect(mocks.router.back).toHaveBeenCalledTimes(1);
  });

  it("sem histórico (aba nova) o link leva para /entrar e não chama back()", async () => {
    setHistoryLength(1);
    render(<BackLink />);
    const link = screen.getByRole("link", { name: "Voltar" });
    expect(link).toHaveAttribute("href", "/entrar");
    await userEvent.click(link);
    expect(mocks.router.back).not.toHaveBeenCalled();
  });

  it("clique com Ctrl ou Shift (abrir em outra aba) segue o link e não chama back()", () => {
    setHistoryLength(3);
    render(<BackLink />);
    const link = screen.getByRole("link", { name: "Voltar" });
    for (const modifier of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
    ]) {
      expect(fireEvent.click(link, modifier)).toBe(true);
    }
    expect(mocks.router.back).not.toHaveBeenCalled();
  });

  it("sem JavaScript o href ainda é /entrar", () => {
    setHistoryLength(3);
    render(<BackLink />);
    expect(screen.getByRole("link", { name: "Voltar" })).toHaveAttribute(
      "href",
      "/entrar",
    );
  });

  it("tem 44px de altura mínima abaixo de md (ui-rules §1.4)", () => {
    setHistoryLength(1);
    render(<BackLink />);
    const classes = screen
      .getByRole("link", { name: "Voltar" })
      .className.split(" ");
    expect(classes).toContain("max-md:min-h-11");
    expect(classes).toContain("max-md:inline-flex");
    expect(classes).toContain("max-md:items-center");
    // "Voltar" é curto: sem largura mínima mede 38px (guarda de toque do E2E).
    expect(classes).toContain("max-md:min-w-11");
  });
});
