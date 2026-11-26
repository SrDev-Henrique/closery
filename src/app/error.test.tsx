import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error.tsx", () => {
  it("mostra o título e o botão 'Tentar de novo'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={new Error("falha interna")} retry={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Algo deu errado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
  });

  it("clicar em 'Tentar de novo' chama retry uma vez", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorPage error={new Error("falha interna")} retry={retry} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("não vaza a mensagem do erro na tela, mas registra só o resumo no console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("senha do banco: hunter2");
    render(<ErrorPage error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0]?.[0]);
    expect(logged).toContain("error-boundary");
    expect(logged).not.toContain("hunter2");
  });

  it("aceita erro que não é Error (o tipo da prop é unknown)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error="texto solto" retry={vi.fn()} />);

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
  });
});
