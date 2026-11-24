import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { CancelRequestDialog } from "./CancelRequestDialog";

const mocks = vi.hoisted(() => ({
  cancelRequestAction: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  cancelRequestAction: mocks.cancelRequestAction,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const ID = "11111111-1111-4111-8111-111111111111";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function openDialog() {
  render(<CancelRequestDialog requestId={ID} from="in_transit" />);
  await userEvent.click(
    screen.getByRole("button", { name: "Cancelar solicitação" }),
  );
  return screen.findByRole("dialog", { name: "Cancelar solicitação" });
}

const reasonField = () => screen.getByLabelText("Motivo do cancelamento");
const confirm = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", {
    name: /Cancelar solicitação|Cancelando/,
  });

describe("CancelRequestDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("o gatilho é o botão destrutivo e o diálogo explica onde o motivo fica", async () => {
    const dialog = await openDialog();

    expect(dialog).toHaveTextContent(
      "O motivo fica na linha do tempo e nos comentários.",
    );
    expect(dialog).toHaveTextContent("Obrigatório.");
    expect(reasonField()).toHaveAttribute("maxlength", "500");
    expect(reasonField().className).toContain("text-base");
    expect(
      within(dialog).getByRole("button", { name: "Voltar" }),
    ).toBeEnabled();
  });

  it("sem motivo: erro no campo e a action não é chamada", async () => {
    const dialog = await openDialog();

    await userEvent.click(confirm(dialog));

    expect(
      within(dialog).getByText("Informe o motivo do cancelamento."),
    ).toBeInTheDocument();
    expect(mocks.cancelRequestAction).not.toHaveBeenCalled();
  });

  it("só espaços também é motivo vazio", async () => {
    const dialog = await openDialog();

    await userEvent.type(reasonField(), "   ");
    await userEvent.click(confirm(dialog));

    expect(
      within(dialog).getByText("Informe o motivo do cancelamento."),
    ).toBeInTheDocument();
    expect(mocks.cancelRequestAction).not.toHaveBeenCalled();
  });

  it("501 pontos de código: erro no campo e a action não é chamada", async () => {
    const dialog = await openDialog();

    fireEvent.change(reasonField(), { target: { value: "😀".repeat(501) } });
    await userEvent.click(confirm(dialog));

    expect(
      within(dialog).getByText("O motivo pode ter no máximo 500 caracteres."),
    ).toBeInTheDocument();
    expect(mocks.cancelRequestAction).not.toHaveBeenCalled();
  });

  it("sucesso: manda id, status visto e motivo, avisa e fecha", async () => {
    mocks.cancelRequestAction.mockResolvedValue(
      ok({ id: ID, status: "cancelled", statusChangedAt: new Date() }),
    );
    const dialog = await openDialog();

    await userEvent.type(reasonField(), "Pedido duplicado");
    await userEvent.click(confirm(dialog));

    expect(mocks.cancelRequestAction).toHaveBeenCalledExactlyOnceWith({
      id: ID,
      from: "in_transit",
      reason: "Pedido duplicado",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Solicitação cancelada.",
    );
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("erro do campo vindo do servidor fica no campo, com o texto mantido", async () => {
    mocks.cancelRequestAction.mockResolvedValue(
      fail("INVALID_INPUT", "Informe o motivo do cancelamento.", {
        reason: "Informe o motivo do cancelamento.",
      }),
    );
    const dialog = await openDialog();

    await userEvent.type(reasonField(), "texto");
    await userEvent.click(confirm(dialog));

    expect(
      within(dialog).getByText("Informe o motivo do cancelamento."),
    ).toBeInTheDocument();
    expect(reasonField()).toHaveValue("texto");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each([
    [
      "SECTOR_INACTIVE",
      "Este setor está inativo. Peça a um administrador para reativá-lo.",
    ],
    ["INTERNAL", "Não foi possível concluir. Tente de novo."],
  ] as const)("%s fica no pé do diálogo, aberto, com o texto", async (code, message) => {
    mocks.cancelRequestAction.mockResolvedValue(fail(code, message));
    const dialog = await openDialog();

    await userEvent.type(reasonField(), "texto");
    await userEvent.click(confirm(dialog));

    expect(within(dialog).getByText(message)).toBeInTheDocument();
    expect(reasonField()).toHaveValue("texto");
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([
    "STATUS_CONFLICT",
    "NO_CHANGES",
    "NOT_FOUND",
  ] as const)("%s: toast com a mensagem, fecha e atualiza a tela", async (code) => {
    mocks.cancelRequestAction.mockResolvedValue(
      fail(code, "Esta solicitação mudou para Entregue por Bia Teste."),
    );
    const dialog = await openDialog();

    await userEvent.type(reasonField(), "texto");
    await userEvent.click(confirm(dialog));

    expect(mocks.toastError).toHaveBeenCalledExactlyOnceWith(
      "Esta solicitação mudou para Entregue por Bia Teste.",
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("pendente: Cancelando… desativado e Voltar também", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.cancelRequestAction.mockReturnValue(pending.promise);
    const dialog = await openDialog();

    await userEvent.type(reasonField(), "texto");
    await userEvent.click(confirm(dialog));

    expect(confirm(dialog)).toHaveTextContent("Cancelando…");
    expect(confirm(dialog)).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Voltar" }),
    ).toBeDisabled();
    expect(mocks.cancelRequestAction).toHaveBeenCalledTimes(1);

    pending.resolve(ok());
  });

  it("Voltar fecha sem chamar a action e o motivo digitado não volta na próxima abertura", async () => {
    const dialog = await openDialog();
    await userEvent.type(reasonField(), "texto");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Voltar" }),
    );
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.cancelRequestAction).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Cancelar solicitação" }),
    );
    await screen.findByRole("dialog", { name: "Cancelar solicitação" });
    expect(reasonField()).toHaveValue("");
  });
});
