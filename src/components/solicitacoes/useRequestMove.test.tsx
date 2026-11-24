import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import type {
  BoardStatus,
  RequestGroups,
  RequestListItem,
} from "@/features/requests/types";
import { requestGroups, requestListItem } from "../../../test/requestCards";
import { useRequestMove } from "./useRequestMove";

const mocks = vi.hoisted(() => ({
  moveRequestAction: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  moveRequestAction: mocks.moveRequestAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
  },
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function Harness({ groups }: { groups: RequestGroups }) {
  const view = useRequestMove(groups);
  const moves: [BoardStatus, string][] = [
    ["in_transit", "Para em separação"],
    ["delivered", "Para entregue"],
  ];
  return (
    <div>
      {(["requested", "in_transit", "delivered"] as const).map((status) => (
        <section key={status} aria-label={status}>
          <span data-testid={`total-${status}`}>
            {view.groups[status].total}
          </span>
          {view.groups[status].rows.map((row: RequestListItem) => (
            <p key={row.id}>
              {row.description}
              {moves.map(([to, label]) => (
                <button
                  key={to}
                  type="button"
                  onClick={() => view.move(row, to)}
                >
                  {label} {row.description}
                </button>
              ))}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

const region = (name: string) => screen.getByRole("region", { name });

describe("useRequestMove", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("move o cartão e as duas contagens antes da resposta, e mantém com as props novas", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    const item = requestListItem({ description: "Rolos" });
    const groups = requestGroups([item]);
    const { rerender } = render(<Harness groups={groups} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Para em separação Rolos" }),
    );

    expect(within(region("in_transit")).getByText("Rolos")).toBeInTheDocument();
    expect(screen.getByTestId("total-requested")).toHaveTextContent("0");
    expect(screen.getByTestId("total-in_transit")).toHaveTextContent("1");
    expect(mocks.moveRequestAction).toHaveBeenCalledExactlyOnceWith({
      id: item.id,
      from: "requested",
      to: "in_transit",
    });

    const moved = { ...item, status: "in_transit" as const };
    await act(async () => {
      pending.resolve(ok());
      rerender(<Harness groups={requestGroups([moved])} />);
    });

    expect(within(region("in_transit")).getByText("Rolos")).toBeInTheDocument();
    expect(mocks.toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "“Rolos” movida para Em separação / Trânsito.",
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("ok:false volta sozinho e o toast nomeia a solicitação", async () => {
    const pending = deferred<ReturnType<typeof fail>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    const item = requestListItem({ description: "Fita" });
    render(<Harness groups={requestGroups([item])} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Para em separação Fita" }),
    );
    expect(within(region("in_transit")).getByText("Fita")).toBeInTheDocument();

    await act(async () => {
      pending.resolve(fail("SECTOR_INACTIVE", "Setor inativo."));
    });

    expect(within(region("requested")).getByText("Fita")).toBeInTheDocument();
    expect(screen.getByTestId("total-requested")).toHaveTextContent("1");
    expect(screen.getByTestId("total-in_transit")).toHaveTextContent("0");
    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível mover “Fita”. Setor inativo.",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    "STATUS_CONFLICT",
    "NO_CHANGES",
    "NOT_FOUND",
  ] as const)("%s atualiza a tela (router.refresh) depois do toast", async (code) => {
    mocks.moveRequestAction.mockResolvedValue(fail(code, "Mudou."));
    render(
      <Harness
        groups={requestGroups([requestListItem({ description: "Mola" })])}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Para em separação Mola" }),
    );

    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("exceção vira INTERNAL e volta o cartão", async () => {
    mocks.moveRequestAction.mockRejectedValue(new Error("rede"));
    render(
      <Harness
        groups={requestGroups([requestListItem({ description: "Cabo" })])}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Para em separação Cabo" }),
    );

    expect(within(region("requested")).getByText("Cabo")).toBeInTheDocument();
    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível mover “Cabo”. Não foi possível concluir. Tente de novo.",
    );
  });

  it("a prévia do toast corta a descrição longa", async () => {
    mocks.moveRequestAction.mockResolvedValue(ok());
    const description = "a".repeat(80);
    render(
      <Harness groups={requestGroups([requestListItem({ description })])} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: `Para entregue ${description}` }),
    );

    expect(mocks.toastSuccess).toHaveBeenCalledExactlyOnceWith(
      `“${"a".repeat(59)}…” movida para Entregue.`,
    );
  });

  it("o cartão movido em voo fica pending (botões desativados pelo consumidor)", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.moveRequestAction.mockReturnValue(pending.promise);
    function Flag({ groups }: { groups: RequestGroups }) {
      const view = useRequestMove(groups);
      const row = view.groups.in_transit.rows[0];
      return (
        <div>
          <button
            type="button"
            onClick={() => {
              const first = groups.requested.rows[0];
              if (first) view.move(first, "in_transit");
            }}
          >
            mover
          </button>
          <span data-testid="flag">{row ? String(row.pending) : "sem"}</span>
        </div>
      );
    }
    render(<Flag groups={requestGroups([requestListItem()])} />);

    expect(screen.getByTestId("flag")).toHaveTextContent("sem");
    await userEvent.click(screen.getByRole("button", { name: "mover" }));
    expect(screen.getByTestId("flag")).toHaveTextContent("true");

    await act(async () => {
      pending.resolve(ok());
    });
  });
});
