import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInPanel } from "./SignInPanel";

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInPasskey: vi.fn(),
  signInSocial: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: {
      email: mocks.signInEmail,
      passkey: mocks.signInPasskey,
      social: mocks.signInSocial,
    },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

const FALLBACK = "Não foi possível concluir. Tente de novo.";

type Props = Partial<Parameters<typeof SignInPanel>[0]>;

function setup(props: Props = {}) {
  return render(
    <SignInPanel providers={[]} initialErrorCode={null} {...props} />,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await user.type(screen.getByLabelText("Senha"), "senha-segura-1");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

function stubConditionalMediation(available: boolean | "throws") {
  const isConditionalMediationAvailable =
    available === "throws"
      ? vi.fn().mockRejectedValue(new Error("boom"))
      : vi.fn().mockResolvedValue(available);
  vi.stubGlobal("PublicKeyCredential", { isConditionalMediationAvailable });
  return isConditionalMediationAvailable;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
  mocks.signInPasskey.mockResolvedValue({ data: {}, error: null });
  mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignInPanel", () => {
  it("mostra os textos do contrato", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Entrar no Closery" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    ).toBeInTheDocument();
    expect(screen.getByText("O acesso é só por convite.")).toBeInTheDocument();
  });

  it("o rodapé diz que a senha esquecida se resolve com o administrador, depois do aviso do convite", () => {
    setup();
    const notes = screen
      .getAllByText(/convite.|Esqueceu a senha?/)
      .map((node) => node.textContent);
    expect(notes).toEqual([
      "O acesso é só por convite.",
      "Esqueceu a senha? Peça ao administrador um link para criar outra.",
    ]);
    expect(screen.queryByText(/Esqueci a senha/)).not.toBeInTheDocument();
  });

  it("e-mail aceita autofill de passkey e senha usa o autocomplete certo", () => {
    setup();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "autocomplete",
      "username webauthn",
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("entra com e-mail e senha e vai para o início atualizando a sessão", async () => {
    setup();
    await fillAndSubmit();

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "senha-segura-1",
    });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("senha errada: mensagem mapeada, valores preservados, sem navegar", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid password" },
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
    expect(screen.queryByText("Invalid password")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Senha")).toHaveValue("senha-segura-1");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("conta desativada mostra a mensagem do contrato", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "ACCOUNT_DEACTIVATED" },
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta conta foi desativada. Fale com o administrador.",
    );
  });

  it("e-mail inválido marca o campo de e-mail", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL" },
    });
    setup();
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("falha de rede mostra o texto padrão e libera o botão", async () => {
    mocks.signInEmail.mockRejectedValue(new Error("Failed to fetch"));
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("trava o duplo clique enquanto o login está pendente", async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    mocks.signInEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    setup();
    const user = await fillAndSubmit();

    const submit = screen.getByRole("button", { name: "Entrar" });
    await waitFor(() => expect(submit).toBeDisabled());
    expect(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    ).toBeDisabled();
    await user.click(submit);
    await user.keyboard("{Enter}");
    expect(mocks.signInEmail).toHaveBeenCalledTimes(1);

    resolveSignIn({ data: {}, error: null });
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledTimes(1));
  });

  it("botão de passkey chama signIn.passkey sem autofill e entra", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
    expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);
    expect(mocks.signInPasskey).toHaveBeenCalledWith();
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("passkey cancelada mostra a mensagem mapeada e libera os botões", async () => {
    mocks.signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "AUTH_CANCELLED", message: "cancelled" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login com passkey cancelado.",
    );
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("cancelar o diálogo do WebAuthn mostra 'Login com passkey cancelado.'", async () => {
    // Código real do @simplewebauthn/browser para NotAllowedError (T14).
    mocks.signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", message: "x" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login com passkey cancelado.",
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("passkey com erro desconhecido usa o texto padrão", async () => {
    mocks.signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "ALGO_NOVO" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("passkey que lança exceção usa o texto padrão e libera os botões", async () => {
    mocks.signInPasskey.mockRejectedValue(new Error("boom"));
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    ).toBeEnabled();
  });

  it("sem provedores sociais habilitados não mostra botões sociais", () => {
    setup({ providers: [] });
    expect(screen.queryByText(/Continuar com/)).not.toBeInTheDocument();
  });

  it("social: entra sem criar conta (requestSignUp false)", async () => {
    setup({ providers: ["google", "facebook"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() => expect(mocks.signInSocial).toHaveBeenCalledTimes(1));
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      requestSignUp: false,
      callbackURL: "/",
      errorCallbackURL: "/entrar",
    });
  });

  it("social com erro devolvido mostra a mensagem mapeada", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { code: "signup_disabled" },
    });
    setup({ providers: ["facebook"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Conta não encontrada. Peça um convite.",
    );
    expect(mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "facebook" }),
    );
  });

  it("erro inicial vindo de ?error= aparece traduzido", () => {
    setup({ initialErrorCode: "access_denied" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Você cancelou o acesso. Tente de novo quando quiser.",
    );
  });

  it("erro inicial desconhecido vira o texto padrão e nunca o texto cru", () => {
    setup({ initialErrorCode: "<img src=x onerror=alert(1)>" });
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("sem erro inicial não há alerta", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("autofill condicional de passkey", () => {
    it("não chama signIn.passkey em ambiente sem WebAuthn", async () => {
      vi.stubGlobal("PublicKeyCredential", undefined);
      setup();
      await Promise.resolve();
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
    });

    it("não chama quando o navegador não oferece mediação condicional", async () => {
      const check = stubConditionalMediation(false);
      setup();
      await waitFor(() => expect(check).toHaveBeenCalled());
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
    });

    it("não chama quando a API existe sem isConditionalMediationAvailable", async () => {
      vi.stubGlobal("PublicKeyCredential", {});
      setup();
      await Promise.resolve();
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
    });

    it("chama signIn.passkey({ autoFill: true }) quando há suporte", async () => {
      stubConditionalMediation(true);
      setup();
      await waitFor(() =>
        expect(mocks.signInPasskey).toHaveBeenCalledWith({ autoFill: true }),
      );
      expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);
    });

    it("autofill bem-sucedido entra e atualiza a sessão", async () => {
      stubConditionalMediation(true);
      setup();
      await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
      expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    });

    it("autofill cancelado ou com erro é silencioso", async () => {
      stubConditionalMediation(true);
      mocks.signInPasskey.mockResolvedValue({
        data: null,
        error: { code: "AUTH_CANCELLED" },
      });
      setup();
      await waitFor(() => expect(mocks.signInPasskey).toHaveBeenCalled());
      await Promise.resolve();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(mocks.router.push).not.toHaveBeenCalled();
    });

    it("exceção ao checar suporte não quebra a tela", async () => {
      const check = stubConditionalMediation("throws");
      setup();
      await waitFor(() => expect(check).toHaveBeenCalled());
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    });

    it("o autofill não trava os botões da tela", async () => {
      stubConditionalMediation(true);
      mocks.signInPasskey.mockReturnValue(new Promise(() => {}));
      setup();
      await waitFor(() => expect(mocks.signInPasskey).toHaveBeenCalled());
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Entrar com passkey" }),
      ).toBeEnabled();
    });
  });

  describe("bloqueio por excesso de tentativas (429)", () => {
    const tooMany = { status: 429, statusText: "Too Many Requests" };

    it("e-mail e senha: 429 sem code mostra a mensagem do limite", async () => {
      mocks.signInEmail.mockResolvedValue({ data: null, error: tooMany });
      setup();
      await fillAndSubmit();

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Muitas tentativas nesta rede. Espere um minuto e tente de novo.",
      );
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    });

    it("social: 429 sem code mostra a mensagem do limite", async () => {
      mocks.signInSocial.mockResolvedValue({ data: null, error: tooMany });
      setup({ providers: ["google"] });
      await userEvent.click(
        screen.getByRole("button", { name: "Continuar com Google" }),
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Muitas tentativas nesta rede. Espere um minuto e tente de novo.",
      );
    });
  });
});
