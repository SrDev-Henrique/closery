import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DashboardBlockBoundary,
  DashboardBlockError,
} from "./DashboardBlockBoundary";

let shouldThrow = true;

function Block({ label }: { label: string }) {
  if (shouldThrow) throw new Error(`falhou ${label}`);
  return <p>bloco ok {label}</p>;
}

describe("DashboardBlockError", () => {
  it("mostra o título, a mensagem e o botão que chama retry", () => {
    const retry = vi.fn();
    render(
      DashboardBlockError(
        { title: "Estoque" },
        { error: new Error("x"), retry, reset: vi.fn() },
      ),
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Estoque" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar este bloco."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("DashboardBlockBoundary (limite real)", () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("o bloco que quebra mostra o fallback e o irmão segue renderizado", () => {
    render(
      <div>
        <DashboardBlockBoundary title="Passagens">
          <Block label="7" />
        </DashboardBlockBoundary>
        <DashboardBlockBoundary title="Estoque">
          <p>irmão vivo</p>
        </DashboardBlockBoundary>
      </div>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Passagens" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar este bloco."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("irmão vivo")).toBeInTheDocument();
  });

  it("Tentar de novo com o filho já bom renderiza o filho", () => {
    render(
      <DashboardBlockBoundary title="Passagens">
        <Block label="7" />
      </DashboardBlockBoundary>,
    );
    shouldThrow = false;

    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(screen.getByText("bloco ok 7")).toBeInTheDocument();
    expect(
      screen.queryByText("Não foi possível carregar este bloco."),
    ).not.toBeInTheDocument();
  });

  it("sem key no limite, trocar só o filho NÃO limpa o erro (o motivo da key)", () => {
    const { rerender } = render(
      <DashboardBlockBoundary title="Passagens">
        <Block key="7" label="7" />
      </DashboardBlockBoundary>,
    );
    shouldThrow = false;

    rerender(
      <DashboardBlockBoundary title="Passagens">
        <Block key="30" label="30" />
      </DashboardBlockBoundary>,
    );

    expect(screen.queryByText("bloco ok 30")).not.toBeInTheDocument();
    expect(
      screen.getByText("Não foi possível carregar este bloco."),
    ).toBeInTheDocument();
  });

  it("com a key no limite, trocar o período remonta e mostra o bloco novo", () => {
    const { rerender } = render(
      <DashboardBlockBoundary key="Passagens:/dashboard" title="Passagens">
        <Block label="7" />
      </DashboardBlockBoundary>,
    );
    shouldThrow = false;

    rerender(
      <DashboardBlockBoundary
        key="Passagens:/dashboard?periodo=30"
        title="Passagens"
      >
        <Block label="30" />
      </DashboardBlockBoundary>,
    );

    expect(screen.getByText("bloco ok 30")).toBeInTheDocument();
    expect(
      screen.queryByText("Não foi possível carregar este bloco."),
    ).not.toBeInTheDocument();
  });

  it("sem erro, é transparente: só mostra os filhos", () => {
    shouldThrow = false;
    render(
      <DashboardBlockBoundary title="Passagens">
        <Block label="7" />
      </DashboardBlockBoundary>,
    );

    expect(screen.getByText("bloco ok 7")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Passagens" }),
    ).not.toBeInTheDocument();
  });
});
