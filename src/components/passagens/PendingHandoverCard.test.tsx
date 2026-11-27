import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PendingHandover } from "@/features/handovers/home";
import { spDate } from "../../../test/clock";
import { PendingHandoverCard } from "./PendingHandoverCard";

// O cartão só desenha: o data URI do avatar vem pronto de quem chama (a semente
// = `deliveredById` é testada no HomeHandovers e no HomeCards).
const AVATAR = "data:image/svg+xml;seed,u-ana";

function renderCard(
  overrides: Partial<PendingHandover> = {},
  avatarSrc = AVATAR,
) {
  return render(
    <PendingHandoverCard pending={pending(overrides)} avatarSrc={avatarSrc} />,
  );
}

function pending(overrides: Partial<PendingHandover> = {}): PendingHandover {
  return {
    id: "h1",
    sectorName: "ULD",
    shiftName: "Turno Manhã",
    operationalDate: "2026-11-20",
    deliveredById: "u-ana",
    deliveredByName: "Ana Teste",
    deliveredAt: spDate("2026-11-20", "14:05"),
    nextShiftPreview: "Rede de proteção no box 4.",
    ...overrides,
  };
}

describe("PendingHandoverCard", () => {
  it("mostra título, turno e data, quem entregou e o que fica para o próximo turno", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "Passagem para confirmar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Turno Manhã · 20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Entregue às 14:05 por Ana Teste"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fica para o próximo turno")).toBeInTheDocument();
    expect(screen.getByText("Rede de proteção no box 4.")).toBeInTheDocument();
  });

  it("é o cartão amarelo (feature) com tinta escura fixa, nos dois temas", () => {
    const { container } = renderCard();

    const card = container.firstElementChild;
    expect(card).toHaveAttribute("data-slot", "pending-handover");
    expect(card).toHaveClass("bg-highlight", "text-on-pastel");
  });

  it("duas colunas só com área útil de 1040px ou mais; abaixo disso, uma", () => {
    const { container } = renderCard();

    expect(container.firstElementChild).toHaveClass(
      "grid",
      "grid-cols-1",
      "gap-6",
      "@min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
    );
  });

  it("o título é Satoshi 900 de 26px (22px no celular)", () => {
    renderCard();

    expect(
      screen.getByRole("heading", { name: "Passagem para confirmar" }),
    ).toHaveClass(
      "font-heading",
      "font-black",
      "text-[26px]",
      "max-md:text-[22px]",
    );
  });

  it("o avatar de quem entregou é o data URI recebido, decorativo, na moldura dos cards coloridos", () => {
    const { container } = renderCard({}, "data:image/svg+xml;seed,u-bruno");

    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/svg+xml;seed,u-bruno");
    expect(img).toHaveAttribute("alt", "");
    expect(img?.parentElement).toHaveClass("bg-on-pastel", "size-[36px]");
    expect(img?.parentElement?.style.transform).toBe("rotate(3deg)");
  });

  it("o texto de quem entregou usa o tom secundário do cartão amarelo", () => {
    renderCard();

    expect(screen.getByText("Entregue às 14:05 por Ana Teste")).toHaveClass(
      "text-on-highlight-muted",
    );
    expect(screen.getByText("Fica para o próximo turno")).toHaveClass(
      "text-on-highlight-soft",
    );
  });

  it("o texto do próximo turno preserva as quebras de linha", () => {
    renderCard({ nextShiftPreview: "Linha 1\nLinha 2" });

    expect(screen.getByText(/Linha 1/)).toHaveClass("whitespace-pre-line");
  });

  it("sem texto para o próximo turno, avisa que nada foi registrado", () => {
    renderCard({ nextShiftPreview: null });

    expect(
      screen.getByText("Nada registrado para o próximo turno."),
    ).toBeInTheDocument();
  });

  it("'Ver passagem' é o primário on-pastel (22px de padding), link para o resumo, com a seta decorativa", () => {
    renderCard({ id: "abc" });

    const link = screen.getByRole("link", { name: "Ver passagem" });
    expect(link).toHaveAttribute("href", "/passagens/abc");
    expect(link).toHaveClass("mt-auto", "bg-on-pastel", "px-[22px]");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("não tem botão de confirmar (a confirmação é no resumo)", () => {
    renderCard();

    expect(
      screen.queryByRole("button", { name: "Confirmar recebimento" }),
    ).not.toBeInTheDocument();
  });
});
