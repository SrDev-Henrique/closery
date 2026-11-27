import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type InviteCounts, InviteTeamCard } from "./InviteTeamCard";

const mocks = vi.hoisted(() => ({ dismiss: vi.fn() }));

vi.mock("@/app/(app)/actions", () => ({
  dismissInviteCardAction: mocks.dismiss,
}));

const AVATAR = "data:image/svg+xml,admin";

function counts(overrides: Partial<InviteCounts> = {}): InviteCounts {
  return {
    sectors: 4,
    shifts: 12,
    items: 9,
    destinations: 5,
    people: 1,
    ...overrides,
  };
}

function renderCard(overrides: Partial<InviteCounts> = {}) {
  return render(
    <InviteTeamCard counts={counts(overrides)} avatarSrc={AVATAR} />,
  );
}

describe("InviteTeamCard", () => {
  beforeEach(() => {
    mocks.dismiss.mockReset();
    // A ação da Task 10 devolve `void` (vai direto no `<form action>`).
    mocks.dismiss.mockResolvedValue(undefined);
  });

  it("mostra o eyebrow, o título, o texto e o avatar do admin", () => {
    const { container } = renderCard();

    expect(screen.getByText("Último passo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Convide sua equipe" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Gere um link de convite para cada pessoa. Operadores entram no setor que você escolher; administradores veem todos os setores.",
      ),
    ).toBeInTheDocument();
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute("src", AVATAR);
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("'Gerar convites' leva à tela de Equipe", () => {
    renderCard();

    expect(
      screen.getByRole("link", { name: "Gerar convites" }),
    ).toHaveAttribute("href", "/admin/equipe");
  });

  it("'Agora não' é um botão que chama a ação de dispensa", async () => {
    renderCard();

    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));

    await waitFor(() => expect(mocks.dismiss).toHaveBeenCalledTimes(1));
  });

  it("lista os cinco cadastros com a contagem e o plural certo", () => {
    renderCard();

    const list = within(screen.getByRole("list"));
    const rows = list.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Feito" + "Setores" + "4 ativos",
      "Feito" + "Turnos" + "12 ativos",
      "Feito" + "Itens" + "9 ativos",
      "Feito" + "Destinos" + "5 ativos",
      "Falta fazer" + "Equipe" + "1 pessoa ativa",
    ]);
  });

  it("singular: '1 ativo'; e a Equipe nunca vem marcada como feita", () => {
    renderCard({ sectors: 1, shifts: 1, items: 1, destinations: 1, people: 1 });

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("1 ativo");
    expect(rows[4]).toHaveAttribute("data-done", "false");
  });

  it("zero cadastros: sem 'ativos' mentirosos, o indicador fica vazio (limite)", () => {
    renderCard({ sectors: 0, shifts: 0, items: 0, destinations: 0 });

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("0 ativos");
    expect(rows.map((row) => row.getAttribute("data-done"))).toEqual([
      "false",
      "false",
      "false",
      "false",
      "false",
    ]);
  });

  it("os quatro cadastros com dados vêm marcados; a Equipe não", () => {
    renderCard();

    expect(
      screen
        .getAllByRole("listitem")
        .map((row) => row.getAttribute("data-done")),
    ).toEqual(["true", "true", "true", "true", "false"]);
  });

  it("cada linha tem pelo menos 44px (min-h-11) e as divisórias usam o token da tinta", () => {
    renderCard();

    const rows = screen.getAllByRole("listitem");
    for (const row of rows) expect(row).toHaveClass("min-h-11");
    expect(rows[0]).not.toHaveClass("border-t");
    expect(rows[1]).toHaveClass("border-t", "border-on-pastel-line");
  });

  it("a divisória soma 1px aos 44px da linha (box-content), como no protótipo", () => {
    renderCard();

    for (const row of screen.getAllByRole("listitem")) {
      expect(row).toHaveClass("box-content");
    }
  });

  it("é um card feature rosa com tinta de pastel e grid de 2 colunas só a partir de 1040px", () => {
    const { container } = renderCard();

    const card = container.querySelector('[data-slot="card"]');
    expect(card).toHaveClass(
      "bg-invite",
      "text-on-pastel",
      "grid",
      "@min-[1040px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]",
    );
  });

  it("os botões nunca quebram linha e o título cai para 22px no celular", () => {
    renderCard();

    expect(screen.getByRole("heading", { level: 2 })).toHaveClass(
      "text-[26px]",
      "max-md:text-[22px]",
    );
    expect(screen.getByRole("link", { name: "Gerar convites" })).toHaveClass(
      "whitespace-nowrap",
    );
    expect(screen.getByRole("button", { name: "Agora não" })).toHaveClass(
      "whitespace-nowrap",
    );
  });

  it("primário com 22px de padding e 'Agora não' com 20px (protótipo)", () => {
    renderCard();

    expect(screen.getByRole("link", { name: "Gerar convites" })).toHaveClass(
      "bg-on-pastel",
      "px-[22px]",
    );
    const dismiss = screen.getByRole("button", { name: "Agora não" });
    expect(dismiss).toHaveClass("bg-on-pastel-secondary", "px-5");
    expect(dismiss).not.toHaveClass("px-[22px]");
    expect(dismiss).toHaveAttribute("type", "submit");
  });

  it("os tiles tracejados usam a tinta do pastel com opacidade (sem rgba no .tsx)", () => {
    const { container } = renderCard();

    for (const opacity of ["40", "30", "20"]) {
      expect(
        container.querySelector(`.border-on-pastel\\/${opacity}`),
      ).not.toBeNull();
    }
    expect(
      screen
        .getAllByRole("listitem")[4]
        ?.querySelector(".border-on-pastel\\/45"),
    ).not.toBeNull();
  });

  it("usa só tokens de cor (sem hex nem classe crua)", () => {
    const { container } = renderCard();

    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc|pink)-\d+/,
    );
  });
});
