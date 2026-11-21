import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { spDate } from "../../../test/clock";
import { AutosaveIndicator } from "./AutosaveIndicator";

const LAST = { at: spDate("2026-11-20", "09:10"), byName: "Bia Teste" };

describe("AutosaveIndicator", () => {
  it("é uma região de status educada (leitor de tela)", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "idle" }}
        lastSaved={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("sem nada salvo e sem rascunho: 'Nada salvo ainda.'", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "idle" }}
        lastSaved={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Nada salvo ainda.")).toBeInTheDocument();
  });

  it("parado, com rascunho do servidor: último salvamento e quem salvou", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "idle" }}
        lastSaved={LAST}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Último salvamento às 09:10 por Bia Teste"),
    ).toBeInTheDocument();
  });

  it("salvando: 'Salvando…'", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "saving" }}
        lastSaved={LAST}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Salvando…")).toBeInTheDocument();
    expect(screen.queryByText(/Último salvamento/)).not.toBeInTheDocument();
  });

  it("salvo: 'Salvo às HH:mm' no fuso de São Paulo", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "saved", at: spDate("2026-11-20", "23:59") }}
        lastSaved={LAST}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Salvo às 23:59")).toBeInTheDocument();
  });

  it("erro: 'Não salvo.', a mensagem e o botão 'Tentar de novo'", async () => {
    const onRetry = vi.fn();
    render(
      <AutosaveIndicator
        status={{ kind: "error", message: "Sem conexão." }}
        lastSaved={LAST}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Não salvo.")).toBeInTheDocument();
    expect(screen.getByText("Sem conexão.")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("fora do erro não há botão de tentar de novo", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "saving" }}
        lastSaved={null}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Tentar de novo" }),
    ).not.toBeInTheDocument();
  });
});
