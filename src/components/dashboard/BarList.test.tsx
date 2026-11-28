import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BarList, type BarListRow } from "./BarList";

function row(overrides: Partial<BarListRow> = {}): BarListRow {
  return {
    key: "a",
    label: "Doca 3",
    value: 100,
    valueText: "1 h 40 min",
    detail: "3 entregues",
    href: "/solicitacoes?visao=tabela",
    ...overrides,
  };
}

function renderList(props: Partial<Parameters<typeof BarList>[0]> = {}) {
  return render(
    <BarList
      label="Tempo até a entrega por destino"
      rows={[
        row(),
        row({ key: "b", label: "Doca 4", value: 50, href: "/b" }),
        row({ key: "c", label: "Doca 5", value: 1, href: "/c" }),
      ]}
      bars
      emptyText="Nenhuma entrega no período."
      moreText={null}
      {...props}
    />,
  );
}

function barWidths(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("li [style]")].map(
    (bar) => bar.style.width,
  );
}

describe("BarList", () => {
  it("cada linha é um link com o valor escrito ao lado", () => {
    renderList();

    const list = screen.getByRole("list", {
      name: "Tempo até a entrega por destino",
    });
    const links = within(list).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/solicitacoes?visao=tabela");
    expect(links[0]).toHaveAccessibleName("Doca 3 1 h 40 min 3 entregues");
    expect(links[0]).toHaveClass("min-h-11");
  });

  it("com barras: largura proporcional ao maior valor, com piso para o que é maior que zero", () => {
    const { container } = renderList();

    expect(barWidths(container)).toEqual(["100%", "50%", "2%"]);
    expect(container.querySelector(".bg-foreground")).not.toBeNull();
  });

  it("sem barras: só o texto, nenhuma barra desenhada", () => {
    const { container } = renderList({ bars: false });

    expect(barWidths(container)).toEqual([]);
  });

  it("valor zero tem barra de 0%", () => {
    const { container } = renderList({
      rows: [row({ value: 0 }), row({ key: "b", value: 0, href: "/b" })],
    });

    expect(barWidths(container)).toEqual(["0%", "0%"]);
  });

  it("o contexto (setor) aparece ao lado do rótulo", () => {
    renderList({ rows: [row({ context: "ULD Teste" })] });

    expect(
      screen.getByRole("link", { name: /Doca 3 · ULD Teste/ }),
    ).toBeInTheDocument();
  });

  it("sem linhas mostra o texto de vazio e nenhuma lista", () => {
    renderList({ rows: [] });

    expect(screen.getByText("Nenhuma entrega no período.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("moreText aparece abaixo da lista", () => {
    renderList({ moreText: "Mostrando 8 de 11 destinos." });

    expect(screen.getByText("Mostrando 8 de 11 destinos.")).toBeInTheDocument();
  });

  it("nunca usa cor crua do Tailwind", () => {
    const { container } = renderList();

    expect(container.innerHTML).not.toMatch(
      /(?:bg|text|border)-(?:red|green|blue|zinc|slate|gray)-\d/,
    );
  });

  it("o trilho da barra usa bg-accent: o bg-muted é igual ao card na paleta nova e o trilho sumia", () => {
    const { container } = renderList();
    const track = container.querySelector("span.h-2");
    expect(track).toHaveClass("bg-accent");
    expect(track).not.toHaveClass("bg-muted");
  });

  it("no hover da linha o trilho troca para bg-card: a linha vira accent e o trilho accent sumia (P109)", () => {
    const { container } = renderList();
    const links = screen.getAllByRole("link");
    const tracks = [...container.querySelectorAll("span.h-2")];
    expect(tracks).toHaveLength(links.length);
    for (const [index, link] of links.entries()) {
      // O grupo tem nome: um `group` sem nome num ancestral trocaria o trilho
      // sem a linha mudar, e o trilho card sumiria sobre a linha card.
      expect(link).toHaveClass("group/bar-row");
      expect(link).not.toHaveClass("group");
      const track = tracks[index];
      expect(link).toContainElement(track as HTMLElement);
      expect(track).toHaveClass("bg-accent", "group-hover/bar-row:bg-card");
      expect(track).not.toHaveClass("group-hover:bg-card");
    }
  });

  it("sem barras, a linha não leva trilho a trocar", () => {
    const { container } = renderList({ bars: false });
    expect(container.querySelector("span.h-2")).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass("hover:bg-accent");
    }
  });

  it("o hover da linha usa bg-accent (o bg-muted era o próprio card e o hover sumia)", () => {
    renderList();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveClass("bg-card", "hover:bg-accent");
      expect(link).not.toHaveClass("hover:bg-muted");
    }
  });
});
