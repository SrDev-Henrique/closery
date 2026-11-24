import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { toGroupView } from "@/features/requests/boardMove";
import { requestGroups, requestListItem } from "../../../test/requestCards";
import { RequestColumn } from "./RequestColumn";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

function setup(
  props: Partial<Parameters<typeof RequestColumn>[0]> = {},
  groups = requestGroups([requestListItem(), requestListItem()]),
) {
  const view = toGroupView(groups);
  const onMove = vi.fn();
  render(
    <TooltipProvider>
      <RequestColumn
        group={view.requested}
        moreHref={null}
        showSector={false}
        note={null}
        onMove={onMove}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onMove };
}

describe("RequestColumn", () => {
  it("é uma região com o nome do status e a contagem do servidor", () => {
    setup(
      {},
      requestGroups([requestListItem(), requestListItem()], { requested: 7 }),
    );

    const region = screen.getByRole("region", { name: "Solicitada" });
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Solicitada",
    );
    expect(within(region).getByText("7")).toBeInTheDocument();
    expect(within(region).getByText("solicitações")).toHaveClass("sr-only");
    expect(within(region).getAllByRole("article")).toHaveLength(2);
  });

  it("coluna vazia diz uma linha", () => {
    setup({}, requestGroups([]));

    expect(screen.getByText("Nenhuma solicitação.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("mostra a nota quando há", () => {
    setup({ note: "Últimos 30 dias" });

    expect(screen.getByText("Últimos 30 dias")).toBeInTheDocument();
  });

  it("sem moreHref não há Carregar mais", () => {
    setup({ moreHref: null });

    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("com moreHref mostra Carregar mais e quantas linhas aparecem", () => {
    setup(
      { moreHref: "/solicitacoes?mais_solicitada=40" },
      requestGroups([requestListItem(), requestListItem()], { requested: 45 }),
    );

    expect(
      screen.getByRole("button", { name: "Carregar mais" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 de 45")).toBeInTheDocument();
  });

  it("o botão do cartão chama onMove com a solicitação e o destino", async () => {
    const item = requestListItem({ description: "Fita adesiva" });
    const { onMove } = setup({}, requestGroups([item]));

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    );

    expect(onMove).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: item.id }),
      "in_transit",
    );
  });

  it("duas colunas na mesma tela têm ids de título diferentes", () => {
    const view = toGroupView(requestGroups([requestListItem()]));
    render(
      <TooltipProvider>
        <RequestColumn
          group={view.requested}
          moreHref={null}
          showSector={false}
          note={null}
          onMove={vi.fn()}
        />
        <RequestColumn
          group={view.requested}
          moreHref={null}
          showSector={false}
          note={null}
          onMove={vi.fn()}
        />
      </TooltipProvider>,
    );

    const ids = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.id);
    expect(new Set(ids).size).toBe(2);
  });
});
