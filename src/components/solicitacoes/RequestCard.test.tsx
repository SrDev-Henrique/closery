import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { requestListItem } from "../../../test/requestCards";
import { RequestCard } from "./RequestCard";

vi.mock("next/link", () => ({
  default: ({
    href,
    scroll,
    children,
    ...rest
  }: {
    href: string;
    scroll?: boolean;
    children: ReactNode;
  }) => (
    <a href={href} data-scroll={String(scroll)} {...rest}>
      {children}
    </a>
  ),
}));

function card(overrides = {}) {
  return { ...requestListItem(overrides), pending: false };
}

function setup(
  props: Partial<Parameters<typeof RequestCard>[0]> = {},
  request = card(),
) {
  render(
    <TooltipProvider>
      <RequestCard request={request} showSector={false} {...props} />
    </TooltipProvider>,
  );
  return request;
}

describe("RequestCard", () => {
  it("a descrição é um link para o detalhe rápido (sem rolar)", () => {
    const request = setup({}, card({ description: "Rolos para a doca" }));

    const link = screen.getByRole("link", { name: "Rolos para a doca" });
    expect(link).toHaveAttribute("href", `/solicitacoes/${request.id}`);
    expect(link).toHaveAttribute("data-scroll", "false");
  });

  it("o ↗ é um <a> para a página completa, com nome e tooltip", async () => {
    const request = setup({}, card({ description: "Rolos para a doca" }));

    const open = screen.getByRole("link", {
      name: "Abrir página completa de Rolos para a doca",
    });
    expect(open).toHaveAttribute("href", `/solicitacoes/${request.id}`);
    expect(open).not.toHaveAttribute("data-scroll");

    fireEvent.pointerEnter(open, { pointerType: "mouse" });
    fireEvent.mouseEnter(open);
    fireEvent.pointerMove(open, { pointerType: "mouse" });
    fireEvent.mouseMove(open);
    await waitFor(() =>
      expect(screen.getByText("Abrir página completa")).toBeInTheDocument(),
    );
  });

  it("mostra destino, quem criou e a data de criação em São Paulo", () => {
    setup({}, card({ destinationName: "Doca 3", createdByName: "Ana Teste" }));

    expect(screen.getByText("Para Doca 3")).toBeInTheDocument();
    expect(
      screen.getByText("Criada por Ana Teste em 20/11/2026"),
    ).toBeInTheDocument();
  });

  it("o setor só aparece com showSector", () => {
    setup({ showSector: true }, card({ sectorName: "Setor Teste" }));

    expect(screen.getByText("Setor Teste")).toBeInTheDocument();
  });

  it("sem showSector o setor não aparece", () => {
    setup({}, card({ sectorName: "Setor Teste" }));

    expect(screen.queryByText("Setor Teste")).not.toBeInTheDocument();
  });

  it.each([
    [0, null],
    [1, "1 item"],
    [3, "3 itens"],
  ] as const)("%i itens → %s", (itemCount, text) => {
    setup({}, card({ itemCount }));

    if (text === null) expect(screen.queryByText(/itens?$/)).toBeNull();
    else expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("comentários só aparecem acima de zero, com o número para leitor de tela", () => {
    setup({}, card({ commentCount: 3 }));

    expect(screen.getByText("3 comentários")).toHaveClass("sr-only");
  });

  it("sem comentários nada é mostrado", () => {
    setup({}, card({ commentCount: 0 }));

    expect(screen.queryByText(/comentários?$/)).toBeNull();
  });

  it("parada mostra o selo com os dias", () => {
    setup({}, card({ stale: true, daysInStatus: 5 }));

    expect(screen.getByText("Parada há 5 dias")).toBeInTheDocument();
  });

  it("sem parada não há selo", () => {
    setup({}, card({ stale: false }));

    expect(screen.queryByText(/Parada há/)).toBeNull();
  });

  it("Solicitada oferece só o próximo passo e chama onMove com o destino", async () => {
    const onMove = vi.fn();
    setup({ onMove }, card({ status: "requested" }));

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    );

    expect(onMove).toHaveBeenCalledExactlyOnceWith("in_transit");
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("Em separação / Trânsito oferece Entregue", () => {
    setup({ onMove: vi.fn() }, card({ status: "in_transit" }));

    expect(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    ).toBeEnabled();
  });

  it.each([
    "delivered",
    "cancelled",
  ] as const)("%s não oferece botão de mover", (status) => {
    setup({ onMove: vi.fn() }, card({ status }));

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("sem onMove não há botão", () => {
    setup({}, card({ status: "requested" }));

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("em voo (pending) o botão fica desativado", () => {
    setup(
      { onMove: vi.fn() },
      { ...card({ status: "in_transit" }), pending: true },
    );

    expect(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    ).toBeDisabled();
  });
});
