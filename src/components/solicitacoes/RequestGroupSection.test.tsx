import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { toGroupView } from "@/features/requests/boardMove";
import { requestGroups, requestListItem } from "../../../test/requestCards";
import { RequestGroupSection } from "./RequestGroupSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function groupOf(rowCount: number, total = rowCount) {
  const rows = Array.from({ length: rowCount }, () => requestListItem());
  return toGroupView(requestGroups(rows, { requested: total })).requested;
}

function setup(
  props: Partial<Parameters<typeof RequestGroupSection>[0]> = {},
  group = groupOf(2),
) {
  const renderRow = vi.fn((row: (typeof group.rows)[number]) => (
    <li key={row.id} data-testid="linha">
      {row.description}
    </li>
  ));
  render(
    <RequestGroupSection
      group={group}
      moreHref={null}
      note={null}
      className="flex flex-col gap-2"
      renderRow={renderRow}
      {...props}
    />,
  );
  return { renderRow, group };
}

describe("RequestGroupSection", () => {
  it("é uma região com o nome do status, o ícone e a contagem do servidor", () => {
    setup({}, groupOf(2, 7));

    const region = screen.getByRole("region", { name: "Solicitada" });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Solicitada",
    );
    expect(region.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    const total = within(region).getByText("7");
    expect(total).toHaveClass("tabular-nums");
    expect(within(region).getByText("solicitações")).toHaveClass("sr-only");
  });

  it("a contagem lida em voz alta é só `7 solicitações`, sem outro dígito no meio", () => {
    setup({}, groupOf(1, 7));

    const region = screen.getByRole("region", { name: "Solicitada" });
    expect(region.querySelector("header")).toHaveTextContent(
      /^Solicitada7 solicitações$/,
    );
  });

  it("chama renderRow uma vez por linha, na ordem, e põe o resultado numa lista", () => {
    const { renderRow, group } = setup({}, groupOf(3));

    expect(renderRow).toHaveBeenCalledTimes(3);
    expect(renderRow.mock.calls.map(([row]) => row.id)).toEqual(
      group.rows.map((row) => row.id),
    );
    const list = screen.getByRole("list");
    expect(within(list).getAllByTestId("linha")).toHaveLength(3);
  });

  it("grupo vazio diz uma linha, sem lista e sem chamar renderRow", () => {
    const { renderRow } = setup({}, groupOf(0));

    expect(screen.getByText("Nenhuma solicitação.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    expect(renderRow).not.toHaveBeenCalled();
  });

  it("mostra a nota quando há e some sem ela", () => {
    setup({ note: "Últimos 30 dias" });

    expect(screen.getByText("Últimos 30 dias")).toHaveClass("text-xs");
  });

  it("sem nota não desenha parágrafo", () => {
    setup({ note: null });

    const region = screen.getByRole("region", { name: "Solicitada" });
    expect(region.querySelector("p")).toBeNull();
  });

  it("Carregar mais só com moreHref, com quantas linhas aparecem", () => {
    setup({ moreHref: null }, groupOf(2, 45));
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("com moreHref mostra Carregar mais e `2 de 45`", () => {
    setup({ moreHref: "/solicitacoes?mais_solicitada=40" }, groupOf(2, 45));

    expect(
      screen.getByRole("button", { name: "Carregar mais" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 de 45")).toBeInTheDocument();
  });

  it("className vai para a <section>", () => {
    setup({ className: "flex flex-col gap-2 classe-do-chamador" });

    expect(screen.getByRole("region", { name: "Solicitada" })).toHaveClass(
      "classe-do-chamador",
    );
  });

  it("duas seções no mesmo documento não repetem o id do título", () => {
    render(
      <>
        <RequestGroupSection
          group={groupOf(1)}
          moreHref={null}
          note={null}
          className="a"
          renderRow={(row) => <li key={row.id}>{row.description}</li>}
        />
        <RequestGroupSection
          group={groupOf(1)}
          moreHref={null}
          note={null}
          className="b"
          renderRow={(row) => <li key={row.id}>{row.description}</li>}
        />
      </>,
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings).toHaveLength(2);
    expect(headings[0]?.id).not.toBe("");
    expect(headings[0]?.id).not.toBe(headings[1]?.id);
    expect(screen.getAllByRole("region", { name: "Solicitada" })).toHaveLength(
      2,
    );
  });
});
