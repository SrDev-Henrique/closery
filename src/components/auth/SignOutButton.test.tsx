import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./SignOutButton";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut: mocks.signOut },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

describe("SignOutButton", () => {
  it("sai, vai para /entrar e atualiza a sessão", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith("/entrar"),
    );
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("erro devolvido: mostra o texto padrão, não navega e libera o botão", async () => {
    mocks.signOut.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "x", message: "texto cru" },
    });
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.queryByText("texto cru")).not.toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
  });

  it("falha de rede (exceção) mostra o texto padrão", async () => {
    mocks.signOut.mockRejectedValue(new Error("Failed to fetch"));
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("trava o duplo clique enquanto pendente", async () => {
    let resolveOut: (value: unknown) => void = () => {};
    mocks.signOut.mockReturnValue(
      new Promise((resolve) => {
        resolveOut = resolve;
      }),
    );
    render(<SignOutButton />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Sair" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    resolveOut({ data: { success: true }, error: null });
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledTimes(1));
  });
});
