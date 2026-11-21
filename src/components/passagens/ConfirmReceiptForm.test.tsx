import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { ConfirmReceiptForm } from "./ConfirmReceiptForm";

const HANDOVER_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";

const mocks = vi.hoisted(() => ({
  confirmHandoverAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/passagens/actions", () => ({
  confirmHandoverAction: mocks.confirmHandoverAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const noteField = () =>
  screen.getByRole("textbox", { name: "Observação do recebimento (opcional)" });
const submit = () =>
  screen.getByRole("button", {
    name: /^Confirmar recebimento$|^Confirmando…$/,
  });

describe("ConfirmReceiptForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa com a observação vazia e o botão com o nome do resultado", () => {
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    expect(noteField()).toHaveValue("");
    expect(submit()).toHaveTextContent("Confirmar recebimento");
    expect(submit()).toBeEnabled();
  });

  it("confirma sem observação: manda texto vazio e mostra o toast", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      ok({ confirmedAt: new Date() }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Recebimento confirmado.",
      ),
    );
    expect(mocks.confirmHandoverAction).toHaveBeenCalledWith({
      id: HANDOVER_ID,
      note: "",
    });
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("manda a observação digitada", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      ok({ confirmedAt: new Date() }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.type(noteField(), "Recebi as redes");
    await user.click(submit());

    await waitFor(() =>
      expect(mocks.confirmHandoverAction).toHaveBeenCalledWith({
        id: HANDOVER_ID,
        note: "Recebi as redes",
      }),
    );
  });

  it("enquanto confirma: botão 'Confirmando…' desabilitado e um clique só", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.confirmHandoverAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    await waitFor(() => expect(submit()).toHaveTextContent("Confirmando…"));
    expect(submit()).toBeDisabled();
    await user.click(submit());
    expect(mocks.confirmHandoverAction).toHaveBeenCalledTimes(1);

    finish(ok({ confirmedAt: new Date() }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
  });

  it("falha de domínio: erro inline, sem toast, e a observação digitada fica", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      fail(
        "OWN_HANDOVER",
        "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
      ),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.type(noteField(), "Tudo certo");
    await user.click(submit());

    expect(
      await screen.findByText(
        "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
      ),
    ).toBeInTheDocument();
    expect(noteField()).toHaveValue("Tudo certo");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it("erro no campo da observação aparece no campo e marca como inválido", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      fail("INVALID_INPUT", "A observação pode ter no máximo 500 caracteres.", {
        note: "A observação pode ter no máximo 500 caracteres.",
      }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    expect(
      await screen.findByText(
        "A observação pode ter no máximo 500 caracteres.",
      ),
    ).toBeInTheDocument();
    expect(noteField()).toHaveAttribute("aria-invalid", "true");
  });

  it("exceção da action (rede) vira a mensagem genérica inline", async () => {
    mocks.confirmHandoverAction.mockRejectedValue(new Error("rede caiu"));
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    expect(
      await screen.findByText("Não foi possível concluir. Tente de novo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("rede caiu")).not.toBeInTheDocument();
  });

  it("depois de um erro, um novo envio limpa o erro anterior", async () => {
    mocks.confirmHandoverAction
      .mockResolvedValueOnce(
        fail("INTERNAL", "Não foi possível concluir. Tente de novo."),
      )
      .mockResolvedValueOnce(ok({ confirmedAt: new Date() }));
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());
    await screen.findByText("Não foi possível concluir. Tente de novo.");
    await user.click(submit());

    await waitFor(() =>
      expect(
        screen.queryByText("Não foi possível concluir. Tente de novo."),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Recebimento confirmado.");
  });
});
