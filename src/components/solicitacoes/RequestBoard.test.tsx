import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import type { BoardStatus } from "@/features/requests/types";
import { requestGroups, requestListItem } from "../../../test/requestCards";
import { RequestBoard } from "./RequestBoard";

const mocks = vi.hoisted(() => ({
  moveRequestAction: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  moveRequestAction: mocks.moveRequestAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const NO_MORE: Record<BoardStatus, string | null> = {
  requested: null,
  in_transit: null,
  delivered: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(
  groups = requestGroups([
    requestListItem({ description: "Rolos" }),
    requestListItem({ description: "Fita", status: "in_transit" }),
  ]),
  props: Partial<Parameters<typeof RequestBoard>[0]> = {},
) {
  render(
    <RequestBoard
      groups={groups}
      moreHrefs={NO_MORE}
      showSector={false}
      closedWindow={false}
      {...props}
    />,
  );
}

const column = (name: string) => screen.getByRole("region", { name });

describe("RequestBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("três colunas na ordem do fluxo, com a contagem do servidor", () => {
    setup(requestGroups([requestListItem()], { requested: 7 }));

    const names = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(names).toEqual([
      "Solicitada",
      "Em separação / Trânsito",
      "Entregue",
    ]);
    expect(within(column("Solicitada")).getByText("7")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Cancelada" })).toBeNull();
  });

  it("o cartão muda de coluna e as duas contagens mudam antes da resposta", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    setup();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    );

    const transit = column("Em separação / Trânsito");
    expect(within(transit).getByText("Rolos")).toBeInTheDocument();
    expect(within(transit).getByText("2")).toBeInTheDocument();
    expect(within(column("Solicitada")).getByText("0")).toBeInTheDocument();
    const deliver = within(transit).getAllByRole("button", {
      name: "Mover para Entregue",
    });
    expect(deliver).toHaveLength(2);
    expect(
      deliver.filter((button) => button.hasAttribute("disabled")),
    ).toHaveLength(1);

    await act(async () => {
      pending.resolve(ok());
    });
  });

  it("ok:false devolve o cartão e avisa pelo nome", async () => {
    const pending = deferred<ReturnType<typeof fail>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    setup();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    );
    await act(async () => {
      pending.resolve(fail("STATUS_CONFLICT", "Mudou."));
    });

    expect(within(column("Solicitada")).getByText("Rolos")).toBeInTheDocument();
    expect(within(column("Solicitada")).getByText("1")).toBeInTheDocument();
    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível mover “Rolos”. Mudou.",
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("Entregue só mostra a nota dos 30 dias quando não há período", () => {
    setup(undefined, { closedWindow: true });
    expect(
      within(column("Entregue")).getByText("Últimos 30 dias"),
    ).toBeInTheDocument();
    expect(
      within(column("Solicitada")).queryByText("Últimos 30 dias"),
    ).toBeNull();
  });

  it("com período escolhido não há nota", () => {
    setup(undefined, { closedWindow: false });

    expect(screen.queryByText("Últimos 30 dias")).toBeNull();
  });

  it("celular: o grupo Coluna tem um botão por coluna com a contagem", () => {
    setup(requestGroups([requestListItem()], { in_transit: 4, delivered: 9 }));

    const group = screen.getByRole("group", { name: "Coluna" });
    expect(
      within(group).getByRole("button", { name: "Solicitada (1)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(group).getByRole("button", {
        name: "Em separação / Trânsito (4)",
      }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(group).getByRole("button", { name: "Entregue (9)" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("celular: só a coluna escolhida fica sem max-md:hidden (só CSS, as três montadas)", async () => {
    setup();

    expect(column("Solicitada").className).not.toContain("max-md:hidden");
    expect(column("Em separação / Trânsito").className).toContain(
      "max-md:hidden",
    );
    expect(column("Entregue").className).toContain("max-md:hidden");

    await userEvent.click(screen.getByRole("button", { name: /^Entregue \(/ }));

    expect(column("Solicitada").className).toContain("max-md:hidden");
    expect(column("Entregue").className).not.toContain("max-md:hidden");
    expect(
      screen.getByRole("button", { name: /^Entregue \(/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("o botão de uma coluna mostra Carregar mais com a contagem do servidor", () => {
    setup(
      requestGroups([requestListItem(), requestListItem()], { requested: 45 }),
      {
        moreHrefs: {
          ...NO_MORE,
          requested: "/solicitacoes?mais_solicitada=40",
        },
      },
    );

    expect(
      within(column("Solicitada")).getByRole("button", {
        name: "Carregar mais",
      }),
    ).toBeInTheDocument();
    expect(
      within(column("Solicitada")).getByText("2 de 45"),
    ).toBeInTheDocument();
    expect(
      within(column("Entregue")).queryByRole("button", {
        name: "Carregar mais",
      }),
    ).toBeNull();
  });

  it("colunas vazias dizem uma linha", () => {
    setup(requestGroups([]));

    expect(screen.getAllByText("Nenhuma solicitação.")).toHaveLength(3);
  });
});
