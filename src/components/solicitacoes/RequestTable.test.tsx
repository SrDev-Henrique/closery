import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Page } from "@/features/admin/pagination";
import type { RequestListItem } from "@/features/requests/types";
import { requestListItem } from "../../../test/requestCards";
import { RequestTable } from "./RequestTable";

function page(
  rows: RequestListItem[],
  overrides: Partial<Page<RequestListItem>> = {},
): Page<RequestListItem> {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageCount: 1,
    pageSize: 50,
    ...overrides,
  };
}

function setup(
  data: Page<RequestListItem>,
  props: Partial<Parameters<typeof RequestTable>[0]> = {},
) {
  render(
    <RequestTable page={data} showSector={false} pageParams={{}} {...props} />,
  );
}

describe("RequestTable", () => {
  it("tem legenda só para leitor de tela e as colunas da spec", () => {
    setup(page([requestListItem()]));

    const table = screen.getByRole("table", { name: "Solicitações" });
    expect(within(table).getByText("Solicitações")).toHaveClass("sr-only");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual([
      "Descrição",
      "Destino",
      "Itens",
      "Quem criou",
      "Criada em",
      "Status",
      "Dias no status",
    ]);
  });

  it("admin em Todos os setores ganha a coluna Setor depois da descrição", () => {
    setup(page([requestListItem({ sectorName: "Setor Teste" })]), {
      showSector: true,
    });

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Descrição",
      "Setor",
      "Destino",
      "Itens",
      "Quem criou",
      "Criada em",
      "Status",
      "Dias no status",
    ]);
    expect(
      screen.getByRole("cell", { name: "Setor Teste" }),
    ).toBeInTheDocument();
  });

  it("a linha mostra descrição (link), destino, quem criou, data, status e dias", () => {
    const row = requestListItem({
      description: "Rolos para a doca",
      destinationName: "Doca 3",
      createdByName: "Bia Teste",
      status: "in_transit",
      itemCount: 2,
      daysInStatus: 4,
    });
    setup(page([row]));

    const line = screen.getByRole("row", { name: /Rolos para a doca/ });
    expect(
      within(line).getByRole("link", { name: "Rolos para a doca" }),
    ).toHaveAttribute("href", `/solicitacoes/${row.id}`);
    expect(within(line).getByText("Doca 3")).toBeInTheDocument();
    expect(within(line).getByText("Bia Teste")).toBeInTheDocument();
    expect(within(line).getByText("20/11/2026")).toBeInTheDocument();
    expect(
      within(line).getByText("Em separação / Trânsito"),
    ).toBeInTheDocument();
    expect(within(line).getByText("2")).toBeInTheDocument();
    expect(within(line).getByText("4")).toBeInTheDocument();
  });

  it("Itens, Criada em e Dias no status ficam à direita com tabular-nums", () => {
    setup(
      page([
        requestListItem({
          description: "Linha única",
          itemCount: 0,
          daysInStatus: 0,
        }),
      ]),
    );

    for (const name of ["Itens", "Criada em", "Dias no status"]) {
      expect(screen.getByRole("columnheader", { name }).className).toContain(
        "text-right",
      );
    }
    const line = screen.getByRole("row", { name: /Linha única/ });
    const cells = within(line).getAllByRole("cell");
    for (const index of [2, 4, 6]) {
      expect(cells[index]?.className).toContain("text-right");
      expect(cells[index]?.className).toContain("tabular-nums");
    }
  });

  it("zero itens e zero dias aparecem como 0, nunca em branco", () => {
    setup(
      page([
        requestListItem({
          description: "Linha zerada",
          itemCount: 0,
          daysInStatus: 0,
        }),
      ]),
    );

    const line = screen.getByRole("row", { name: /Linha zerada/ });
    const cells = within(line).getAllByRole("cell");
    expect(cells[2]).toHaveTextContent("0");
    expect(cells[6]).toHaveTextContent("0");
  });

  it("parada ganha o selo ao lado do status", () => {
    setup(page([requestListItem({ stale: true, daysInStatus: 5 })]));

    expect(screen.getByText("Parada há 5 dias")).toBeInTheDocument();
  });

  it("destino digitado ('Outro') aparece com o rótulo de outro destino", () => {
    setup(
      page([
        requestListItem({
          destinationName: "Galpão Anexo",
          destinationIsOther: true,
        }),
      ]),
    );

    expect(
      screen.getByText("Galpão Anexo (outro destino)"),
    ).toBeInTheDocument();
  });

  it("o contêiner da tabela rola na horizontal (a página não)", () => {
    setup(page([requestListItem()]));

    const container = screen
      .getByRole("table", { name: "Solicitações" })
      .closest("[data-slot='table-container']");
    expect(container?.className).toContain("overflow-x-auto");
  });

  it("uma página só não tem paginação", () => {
    setup(page([requestListItem()]));

    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
  });

  it("a paginação preserva os filtros e leva à próxima página", () => {
    setup(page([requestListItem()], { total: 120, pageCount: 3, page: 1 }), {
      pageParams: { visao: "tabela", busca: "rolos" },
    });

    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/solicitacoes?visao=tabela&busca=rolos&pagina=2",
    );
    expect(within(nav).getByText("Página 1 de 3")).toBeInTheDocument();
  });

  it("sem linhas só mostra o cabeçalho", () => {
    setup(page([], { total: 0 }));

    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
