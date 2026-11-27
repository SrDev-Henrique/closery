import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm, takeTokenFromLocation } from "./ResetPasswordForm";

const mocks = vi.hoisted(() => ({ resetPassword: vi.fn() }));

vi.mock("@/lib/auth/client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}));

const TOKEN = "AbCdEf0123456789_-AbCdEf0123456789_-AbCdEf0123";
const LOCATION = { pathname: "/redefinir-senha", search: "" };

function setHash(hash: string) {
  window.history.replaceState(null, "", `/redefinir-senha${hash}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resetPassword.mockResolvedValue({
    data: { status: true },
    error: null,
  });
});

afterEach(() => {
  setHash("");
});

describe("takeTokenFromLocation", () => {
  it("lê o token do fragmento e apaga o fragmento, mantendo o caminho e a query", () => {
    const replaceState = vi.fn();
    const token = takeTokenFromLocation(
      { hash: `#token=${TOKEN}`, pathname: "/redefinir-senha", search: "?a=1" },
      { replaceState },
    );
    expect(token).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/redefinir-senha?a=1");
  });

  it("aceita os limites: 16 e 256 caracteres", () => {
    for (const size of [16, 256]) {
      const replaceState = vi.fn();
      const token = "a".repeat(size);
      expect(
        takeTokenFromLocation(
          { ...LOCATION, hash: `#token=${token}` },
          { replaceState },
        ),
      ).toBe(token);
    }
  });

  it.each([
    ["vazio", ""],
    ["só o #", "#"],
    ["sem valor", "#token="],
    ["15 caracteres", `#token=${"a".repeat(15)}`],
    ["257 caracteres", `#token=${"a".repeat(257)}`],
    ["outro parâmetro", `#outro=${TOKEN}`],
    ["espaço", "#token=a b"],
    ["parâmetro a mais", `#token=${TOKEN}&x=1`],
    ["unicode", `#token=${"é".repeat(20)}`],
  ])("fragmento %s não é token: devolve null sem mexer na barra", (_name, hash) => {
    const replaceState = vi.fn();
    expect(
      takeTokenFromLocation({ ...LOCATION, hash }, { replaceState }),
    ).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("ResetPasswordForm", () => {
  it("lendo (primeira renderização, no servidor): cartão vazio e ocupado, sem formulário", () => {
    const html = renderToString(<ResetPasswordForm />);

    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Senha nova");
    expect(html).not.toContain("Link incompleto");
  });

  it("sem token: mostra link incompleto, sem formulário, e o botão leva à entrada", async () => {
    setHash("");
    render(<ResetPasswordForm />);

    expect(
      await screen.findByRole("heading", { name: "Link incompleto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Abra o link de redefinição completo, do jeito que o administrador enviou. Se ele não funcionar, peça outro.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha nova")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ir para a entrada" }),
    ).toHaveAttribute("href", "/entrar");
  });

  it("com token: tira o fragmento da barra de endereço e envia a senha nova", async () => {
    setHash(`#token=${TOKEN}`);
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    expect(
      await screen.findByRole("heading", { name: "Criar uma senha nova" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Use pelo menos 8 caracteres."),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    await user.type(screen.getByLabelText("Senha nova"), "senha-nova-4567");
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(mocks.resetPassword).toHaveBeenCalledTimes(1);
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "senha-nova-4567",
      token: TOKEN,
    });
    expect(
      await screen.findByRole("heading", { name: "Senha alterada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Por segurança, todos os acessos abertos foram encerrados. Entre com a senha nova.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/entrar",
    );
  });

  it("o campo é de senha nova, obrigatório, de 8 a 128 caracteres", async () => {
    setHash(`#token=${TOKEN}`);
    render(<ResetPasswordForm />);

    const field = await screen.findByLabelText("Senha nova");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    expect(field).toBeRequired();
    expect(field).toHaveAttribute("minlength", "8");
    expect(field).toHaveAttribute("maxlength", "128");
  });

  it("em StrictMode o token lido na primeira passada não se perde", async () => {
    setHash(`#token=${TOKEN}`);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <ResetPasswordForm />
      </StrictMode>,
    );

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "senha-nova-4567",
      token: TOKEN,
    });
  });

  it("token vencido ou usado: mensagem em português e o formulário continua", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "INVALID_TOKEN", status: 400 },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText(
        "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Senha nova")).toBeEnabled();
    expect(screen.getByLabelText("Senha nova")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("senha curta devolvida pelo servidor: mensagem do código", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "PASSWORD_TOO_SHORT", status: 400 },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(await screen.findByLabelText("Senha nova"), "12345678");
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText("A senha precisa ter pelo menos 8 caracteres."),
    ).toBeInTheDocument();
  });

  it("429: mensagem de muitas tentativas", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 429 },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText(
        "Muitas tentativas nesta rede. Espere um minuto e tente de novo.",
      ),
    ).toBeInTheDocument();
  });

  it("falha de rede: mensagem genérica e botão liberado", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockRejectedValue(new Error("rede"));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText("Não foi possível concluir. Tente de novo."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Trocar a senha" }),
      ).toBeEnabled(),
    );
  });
});
