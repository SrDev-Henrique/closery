import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/features/admin/result";
import { PasswordResetLinkButton } from "./PasswordResetLinkButton";

const mocks = vi.hoisted(() => ({
  createPasswordResetLinkAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
  share: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  createPasswordResetLinkAction: mocks.createPasswordResetLinkAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const URL_OK = "https://closery.example.test/redefinir-senha#token=abc";
// 12:00 UTC = 09:00 em São Paulo (UTC-3, sem horário de verão em 2026).
const EXPIRES_AT = new Date("2026-11-26T12:00:00.000Z");
const GENERATE = {
  name: "Gerar link de nova senha para Bruno Fictício",
};

function defineNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function renderButton() {
  const user = userEvent.setup();
  // O userEvent.setup() instala o próprio clipboard: o espião entra depois.
  defineNavigator("clipboard", { writeText: mocks.writeText });
  render(<PasswordResetLinkButton personId="p1" personName="Bruno Fictício" />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createPasswordResetLinkAction.mockResolvedValue({
    ok: true,
    url: URL_OK,
    expiresAt: EXPIRES_AT,
  });
  mocks.writeText.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  defineNavigator("clipboard", { writeText: mocks.writeText });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("PasswordResetLinkButton", () => {
  it("antes do clique não chama a action nem mostra o diálogo", () => {
    renderButton();

    expect(screen.getByRole("button", GENERATE)).toHaveTextContent(
      "Nova senha",
    );
    expect(mocks.createPasswordResetLinkAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("um clique gera o link e mostra o link, o nome e a validade", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledTimes(1);
    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledWith({
      userId: "p1",
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Link de nova senha",
    });
    expect(dialog).toHaveTextContent("Bruno Fictício");
    const field = screen.getByLabelText("Link para copiar");
    expect(field).toHaveValue(URL_OK);
    expect(field).toHaveAttribute("readonly");
    expect(
      screen.getByText(
        "Válido até 26/11/2026, 09:00, uma vez só. Quem abrir o link troca a senha e todos os acessos abertos dessa pessoa são encerrados. O link aparece só agora: se perder, gere outro (o anterior deixa de valer).",
      ),
    ).toBeInTheDocument();
  });

  it("falha do servidor vira toast e nenhum link aparece", async () => {
    mocks.createPasswordResetLinkAction.mockResolvedValue(
      fail(
        "PERSON_INACTIVE",
        "Esta conta está desativada. Reative antes de gerar um link de redefinição.",
      ),
    );
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Esta conta está desativada. Reative antes de gerar um link de redefinição.",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link para copiar")).toBeNull();
  });

  it("exceção da action (rede) vira o toast genérico", async () => {
    mocks.createPasswordResetLinkAction.mockRejectedValue(new Error("rede"));
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o botão fica desabilitado enquanto a action roda", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createPasswordResetLinkAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    expect(screen.getByRole("button", GENERATE)).toBeDisabled();
    finish({ ok: true, url: URL_OK, expiresAt: EXPIRES_AT });
    await screen.findByRole("dialog");
    // Com o diálogo aberto o resto da página fica aria-hidden.
    expect(
      screen.getByRole("button", { ...GENERATE, hidden: true }),
    ).toBeEnabled();
  });

  it("Copiar link copia o link e avisa", async () => {
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OK);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
  });

  it("sem navigator.share não mostra Compartilhar", async () => {
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");

    expect(
      screen.queryByRole("button", { name: "Compartilhar" }),
    ).not.toBeInTheDocument();
  });

  it("com navigator.share, Compartilhar envia o título e o texto da nova senha", async () => {
    defineNavigator("share", mocks.share);
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));

    await user.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    expect(mocks.share).toHaveBeenCalledWith({
      title: "Nova senha do Closery",
      text: "Abra este link para criar uma senha nova no Closery.",
      url: URL_OK,
    });
  });

  it("fechar o diálogo descarta o link: gerar de novo chama a action outra vez", async () => {
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Link para copiar")).toBeNull();

    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");
    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledTimes(2);
  });
});
