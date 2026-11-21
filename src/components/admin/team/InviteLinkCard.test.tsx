import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InviteLinkCard } from "./InviteLinkCard";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
  share: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const URL_OF_INVITE = "https://closery.example.test/convite/token-de-teste";
// 17:30 UTC = 14:30 em São Paulo (UTC-3, sem horário de verão em 2026).
const EXPIRES_AT = new Date("2026-11-28T17:30:00.000Z");

function defineNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function setup(onReset = vi.fn()) {
  render(
    <InviteLinkCard
      url={URL_OF_INVITE}
      expiresAt={EXPIRES_AT}
      onReset={onReset}
    />,
  );
  return { onReset };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writeText.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  defineNavigator("clipboard", { writeText: mocks.writeText });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("InviteLinkCard", () => {
  it("mostra o título, o link somente leitura e a validade", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "Convite gerado" }),
    ).toBeInTheDocument();
    const field = screen.getByLabelText("Link do convite");
    expect(field).toHaveValue(URL_OF_INVITE);
    expect(field).toHaveAttribute("readonly");
    expect(
      screen.getByText(
        "Válido até 28/11/2026, 14:30. O link aparece só agora: se perder, cancele o convite e gere outro.",
      ),
    ).toBeInTheDocument();
  });

  it("Copiar link copia o link e avisa", async () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado."),
    );
    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_INVITE);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("copiar recusado pelo navegador avisa como copiar à mão", async () => {
    mocks.writeText.mockRejectedValue(
      new DOMException("negado", "NotAllowedError"),
    );
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível copiar. Selecione o link e copie.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("sem navigator.clipboard (contexto inseguro) também avisa, sem quebrar", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível copiar. Selecione o link e copie.",
      ),
    );
  });

  it("sem navigator.share não mostra Compartilhar", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: "Compartilhar" }),
    ).not.toBeInTheDocument();
  });

  it("com navigator.share mostra Compartilhar e envia título, texto e link", async () => {
    defineNavigator("share", mocks.share);
    setup();

    fireEvent.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    await waitFor(() =>
      expect(mocks.share).toHaveBeenCalledWith({
        title: "Convite para o Closery",
        text: "Você foi convidado para o Closery.",
        url: URL_OF_INVITE,
      }),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("fechar a folha de compartilhamento (AbortError) é silencioso", async () => {
    mocks.share.mockRejectedValue(new DOMException("fechou", "AbortError"));
    defineNavigator("share", mocks.share);
    setup();

    fireEvent.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    await waitFor(() => expect(mocks.share).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("falha real ao compartilhar cai para copiar o link", async () => {
    mocks.share.mockRejectedValue(
      new DOMException("sem app", "NotAllowedError"),
    );
    defineNavigator("share", mocks.share);
    setup();

    fireEvent.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_INVITE),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
  });

  it("Gerar outro convite chama onReset", () => {
    const { onReset } = setup();

    fireEvent.click(
      screen.getByRole("button", { name: "Gerar outro convite" }),
    );

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
