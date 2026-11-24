import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { CommentComposer } from "./CommentComposer";

const mocks = vi.hoisted(() => ({
  addCommentAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/solicitacoes/actions", () => ({
  addCommentAction: mocks.addCommentAction,
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

const field = () => screen.getByLabelText("Novo comentário");
const send = () => screen.getByRole("button", { name: /Comentar|Comentando/ });

describe("CommentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("campo com 16px, limite de 2.000 e botão Comentar", () => {
    render(<CommentComposer requestId={ID} />);

    expect(field()).toHaveAttribute("maxlength", "2000");
    expect(field().className).toContain("text-base");
    expect(send()).toHaveTextContent("Comentar");
  });

  it("vazio ou só espaços: erro no campo e a action não é chamada", async () => {
    render(<CommentComposer requestId={ID} />);

    await userEvent.click(send());
    expect(screen.getByText("Escreva o comentário.")).toBeInTheDocument();

    await userEvent.type(field(), "   ");
    await userEvent.click(send());

    expect(screen.getByText("Escreva o comentário.")).toBeInTheDocument();
    expect(mocks.addCommentAction).not.toHaveBeenCalled();
  });

  it("2.001 pontos de código: erro no campo e a action não é chamada", async () => {
    render(<CommentComposer requestId={ID} />);

    fireEvent.change(field(), { target: { value: "😀".repeat(2001) } });
    await userEvent.click(send());

    expect(
      screen.getByText("O comentário pode ter no máximo 2.000 caracteres."),
    ).toBeInTheDocument();
    expect(mocks.addCommentAction).not.toHaveBeenCalled();
  });

  it("2.000 pontos de código passam", async () => {
    mocks.addCommentAction.mockResolvedValue(
      ok({ id: "c1", createdAt: new Date() }),
    );
    render(<CommentComposer requestId={ID} />);

    fireEvent.change(field(), { target: { value: "😀".repeat(2000) } });
    await userEvent.click(send());

    expect(mocks.addCommentAction).toHaveBeenCalledTimes(1);
  });

  it("sucesso: manda o texto, avisa e limpa o campo", async () => {
    mocks.addCommentAction.mockResolvedValue(
      ok({ id: "c1", createdAt: new Date() }),
    );
    render(<CommentComposer requestId={ID} />);

    await userEvent.type(field(), "Separado e na doca");
    await userEvent.click(send());

    expect(mocks.addCommentAction).toHaveBeenCalledExactlyOnceWith({
      requestId: ID,
      body: "Separado e na doca",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledExactlyOnceWith(
      "Comentário adicionado.",
    );
    expect(field()).toHaveValue("");
  });

  it("falha do servidor: o texto fica e a mensagem aparece no campo", async () => {
    mocks.addCommentAction.mockResolvedValue(
      fail(
        "SECTOR_INACTIVE",
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    );
    render(<CommentComposer requestId={ID} />);

    await userEvent.type(field(), "Texto importante");
    await userEvent.click(send());

    expect(field()).toHaveValue("Texto importante");
    expect(
      screen.getByText(
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    ).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("erro do campo vindo do servidor aparece no campo", async () => {
    mocks.addCommentAction.mockResolvedValue(
      fail("INVALID_INPUT", "Escreva o comentário.", {
        body: "Escreva o comentário.",
      }),
    );
    render(<CommentComposer requestId={ID} />);

    await userEvent.type(field(), "x");
    await userEvent.click(send());

    expect(screen.getByText("Escreva o comentário.")).toBeInTheDocument();
  });

  it("pendente: botão Comentando… desativado, sem envio duplo", async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mocks.addCommentAction.mockReturnValue(pending.promise);
    render(<CommentComposer requestId={ID} />);

    await userEvent.type(field(), "Oi");
    await userEvent.click(send());

    expect(send()).toHaveTextContent("Comentando…");
    expect(send()).toBeDisabled();
    const form = field().closest("form");
    if (!form) throw new Error("sem formulário");
    fireEvent.submit(form);
    expect(mocks.addCommentAction).toHaveBeenCalledTimes(1);

    pending.resolve(ok());
  });
});
