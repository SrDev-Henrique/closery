import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ok } from "@/features/admin/result";
import type { RequestStatus } from "@/features/requests/types";
import { requestGroups, requestListItem } from "../../../test/requestCards";
import { RequestList } from "./RequestList";

const mocks = vi.hoisted(() => ({
  moveRequestAction: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  moveRequestAction: mocks.moveRequestAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
  unstable_rethrow: () => {},
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NO_MORE: Record<RequestStatus, string | null> = {
  requested: null,
  in_transit: null,
  delivered: null,
  cancelled: null,
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
    requestListItem({ description: "Cabo", status: "delivered" }),
    requestListItem({ description: "Mola", status: "cancelled" }),
  ]),
  props: Partial<Parameters<typeof RequestList>[0]> = {},
) {
  render(
    <RequestList
      groups={groups}
      moreHrefs={NO_MORE}
      showSector={false}
      closedWindow={false}
      {...props}
    />,
  );
}

const group = (name: string) => screen.getByRole("region", { name });

describe("RequestList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("os quatro grupos, na ordem, com a contagem do servidor", () => {
    setup(requestGroups([requestListItem()], { cancelled: 12 }));

    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual([
      "Solicitada",
      "Em separação / Trânsito",
      "Entregue",
      "Cancelada",
    ]);
    expect(within(group("Cancelada")).getByText("12")).toBeInTheDocument();
  });

  it("cada linha é um item de lista com a descrição como link", () => {
    setup();

    const rolos = within(group("Solicitada")).getByRole("listitem");
    expect(
      within(rolos).getByRole("link", { name: "Rolos" }),
    ).toBeInTheDocument();
  });

  it("a linha oferece só o próximo passo", () => {
    setup();

    expect(
      within(group("Solicitada")).getByRole("button", {
        name: "Mover para Em separação / Trânsito",
      }),
    ).toBeInTheDocument();
    expect(
      within(group("Em separação / Trânsito")).getByRole("button", {
        name: "Mover para Entregue",
      }),
    ).toBeInTheDocument();
    expect(within(group("Entregue")).queryByRole("button")).toBeNull();
    expect(within(group("Cancelada")).queryByRole("button")).toBeNull();
  });

  it("grupo vazio diz uma linha", () => {
    setup(requestGroups([requestListItem()]));

    expect(
      within(group("Cancelada")).getByText("Nenhuma solicitação."),
    ).toBeInTheDocument();
  });

  it("Entregue e Cancelada mostram a nota dos 30 dias só sem período", () => {
    setup(undefined, { closedWindow: true });

    expect(
      within(group("Entregue")).getByText("Últimos 30 dias"),
    ).toBeInTheDocument();
    expect(
      within(group("Cancelada")).getByText("Últimos 30 dias"),
    ).toBeInTheDocument();
    expect(
      within(group("Solicitada")).queryByText("Últimos 30 dias"),
    ).toBeNull();
  });

  it("mover pela linha troca de grupo e de contagem antes da resposta", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Mover para Entregue" }),
    );

    expect(within(group("Entregue")).getByText("Fita")).toBeInTheDocument();
    expect(within(group("Entregue")).getByText("2")).toBeInTheDocument();
    expect(
      within(group("Em separação / Trânsito")).getByText("0"),
    ).toBeInTheDocument();

    await act(async () => {
      pending.resolve(ok());
    });
  });

  it("mostra o setor só com showSector", () => {
    setup(requestGroups([requestListItem({ sectorName: "Setor Teste" })]), {
      showSector: true,
    });

    expect(screen.getByText("Setor Teste")).toBeInTheDocument();
  });

  it("Carregar mais aparece só no grupo com href", () => {
    setup(
      requestGroups([requestListItem(), requestListItem()], { requested: 30 }),
      {
        moreHrefs: {
          ...NO_MORE,
          requested: "/solicitacoes?mais_solicitada=40",
        },
      },
    );

    expect(
      within(group("Solicitada")).getByRole("button", {
        name: "Carregar mais",
      }),
    ).toBeInTheDocument();
    expect(
      within(group("Cancelada")).queryByRole("button", {
        name: "Carregar mais",
      }),
    ).toBeNull();
  });
});
