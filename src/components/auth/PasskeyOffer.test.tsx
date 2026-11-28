import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasskeyOffer } from "./PasskeyOffer";

const mocks = vi.hoisted(() => ({
  addPasskey: vi.fn(),
  toastSuccess: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { passkey: { addPasskey: mocks.addPasskey } },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

const FALLBACK = "Não foi possível concluir. Tente de novo.";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.addPasskey.mockResolvedValue({ data: {}, error: null });
});

describe("PasskeyOffer", () => {
  it("mostra os textos do contrato", () => {
    render(<PasskeyOffer />);
    expect(
      screen.getByRole("heading", { name: "Conta criada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "A passkey é a forma mais rápida de entrar: você usa a digital, o rosto ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao administrador um link para criar outra.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar passkey" }),
    ).toBeInTheDocument();
  });

  it("'Agora não' é um link para o início", () => {
    render(<PasskeyOffer />);
    expect(screen.getByRole("link", { name: "Agora não" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("'Agora não' fica no rodapé com hover local no escuro: input/50 no lugar do accent/50 do ghost (P109)", () => {
    const { container } = render(<PasskeyOffer />);
    const link = screen.getByRole("link", { name: "Agora não" });
    const footer = container.querySelector('[data-slot="card-footer"]');
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer).toContainElement(link);
    // O cn junta as classes: o hover local substitui o do ghost, não soma.
    expect(link).toHaveClass("hover:bg-accent", "dark:hover:bg-input/50");
    expect(link).not.toHaveClass("dark:hover:bg-accent/50");
    expect(link).not.toHaveClass("dark:hover:bg-accent");
  });

  it("cria a passkey, avisa e vai para o início", async () => {
    render(<PasskeyOffer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey criada.");
  });

  it.each([
    ["REGISTRATION_CANCELLED", "Criação da passkey cancelada."],
    ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "Criação da passkey cancelada."],
    ["ERROR_CEREMONY_ABORTED", "Criação da passkey cancelada."],
    ["PREVIOUSLY_REGISTERED", "Esta passkey já está cadastrada."],
    [
      "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
      "Esta passkey já está cadastrada.",
    ],
    [
      "SESSION_NOT_FRESH",
      "Por segurança, entre de novo antes de criar uma passkey.",
    ],
  ])("erro %s mostra a mensagem mapeada e não navega", async (code, message) => {
    mocks.addPasskey.mockResolvedValue({
      data: null,
      error: { code, message: "texto cru" },
    });
    render(<PasskeyOffer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("texto cru")).not.toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar passkey" })).toBeEnabled();
  });

  it("código desconhecido ou exceção usa o texto padrão e libera o botão", async () => {
    mocks.addPasskey.mockRejectedValue(new Error("boom"));
    render(<PasskeyOffer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.getByRole("button", { name: "Criar passkey" })).toBeEnabled();
  });

  it("trava o duplo clique enquanto a criação está pendente", async () => {
    let resolveAdd: (value: unknown) => void = () => {};
    mocks.addPasskey.mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      }),
    );
    render(<PasskeyOffer />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Criar passkey" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);

    resolveAdd({ data: {}, error: null });
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledTimes(1));
  });
});
