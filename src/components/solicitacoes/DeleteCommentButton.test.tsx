import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { DeleteCommentButton } from "./DeleteCommentButton";

const mocks = vi.hoisted(() => ({
  deleteCommentAction: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  deleteCommentAction: mocks.deleteCommentAction,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

const ID = "11111111-1111-4111-8111-111111111111";
const AT = new Date("2026-11-20T12:00:00Z");

function setup() {
  render(<DeleteCommentButton commentId={ID} createdAt={AT} />);
}

const trigger = () =>
  screen.getByRole("button", {
    name: "Apagar comentário de 20/11/2026, 09:00",
  });

describe("DeleteCommentButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("o botão diz Apagar e o nome acessível cita a data do comentário", () => {
    setup();

    expect(trigger()).toHaveTextContent("Apagar");
  });

  it("pede confirmação antes de chamar a action", async () => {
    setup();

    await userEvent.click(trigger());

    expect(
      await screen.findByRole("dialog", { name: "Apagar comentário?" }),
    ).toHaveTextContent("Ele some da solicitação para todos.");
    expect(mocks.deleteCommentAction).not.toHaveBeenCalled();
  });

  it("Voltar não chama a action", async () => {
    setup();
    await userEvent.click(trigger());

    await userEvent.click(
      await screen.findByRole("button", { name: "Voltar" }),
    );

    expect(mocks.deleteCommentAction).not.toHaveBeenCalled();
  });

  it("confirmar apaga e avisa", async () => {
    mocks.deleteCommentAction.mockResolvedValue(ok());
    setup();
    await userEvent.click(trigger());

    await userEvent.click(
      await screen.findByRole("button", { name: "Apagar comentário" }),
    );

    expect(mocks.deleteCommentAction).toHaveBeenCalledExactlyOnceWith({
      id: ID,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Comentário apagado.",
    );
  });

  it("falha do servidor fica no diálogo, sem toast de sucesso", async () => {
    mocks.deleteCommentAction.mockResolvedValue(
      fail("FORBIDDEN", "Só quem escreveu o comentário pode apagá-lo."),
    );
    setup();
    await userEvent.click(trigger());

    await userEvent.click(
      await screen.findByRole("button", { name: "Apagar comentário" }),
    );

    expect(
      await screen.findByText("Só quem escreveu o comentário pode apagá-lo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
