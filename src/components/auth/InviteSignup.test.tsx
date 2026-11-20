import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteSignup } from "./InviteSignup";

const mocks = vi.hoisted(() => ({
  armInvite: vi.fn(),
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/(auth)/convite/[token]/actions", () => ({
  armInvite: mocks.armInvite,
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signUp: { email: mocks.signUpEmail },
    signIn: { social: mocks.signInSocial },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const TOKEN = "T".repeat(43);
const FALLBACK = "Não foi possível concluir. Tente de novo.";

type Props = Partial<Parameters<typeof InviteSignup>[0]>;

function setup(props: Props = {}) {
  return render(
    <InviteSignup
      token={TOKEN}
      providers={[]}
      defaultName=""
      initialErrorCode={null}
      {...props}
    />,
  );
}

async function fillAndSubmit(name = "Ana Teste") {
  const user = userEvent.setup();
  const nameInput = screen.getByLabelText("Nome");
  await user.clear(nameInput);
  await user.type(nameInput, name);
  await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await user.type(screen.getByLabelText("Senha"), "senha-segura-1");
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  return user;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.armInvite.mockResolvedValue({ ok: true });
  mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
  mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
});

describe("InviteSignup", () => {
  it("começa com o nome sugerido e e-mail/senha vazios", () => {
    setup({ defaultName: "Maria Convidada" });
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria Convidada");
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("campos de digitação têm o tipo e o autocomplete certos", () => {
    setup();
    expect(screen.getByLabelText("Nome")).toHaveAttribute(
      "autocomplete",
      "name",
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("arma o convite, cria a conta e vai para /bem-vindo", async () => {
    setup();
    await fillAndSubmit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/bem-vindo"));
    expect(mocks.armInvite).toHaveBeenCalledWith(TOKEN);
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      name: "Ana Teste",
      email: "ana@example.com",
      password: "senha-segura-1",
    });
    expect(mocks.armInvite.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signUpEmail.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("convite que deixou de valer: mostra o motivo e não cria conta", async () => {
    mocks.armInvite.mockResolvedValue({
      ok: false,
      message: "Este convite expirou. Peça um novo convite a quem te convidou.",
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este convite expirou. Peça um novo convite a quem te convidou.",
    );
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  it("e-mail já cadastrado: mensagem mapeada, campo marcado e valores preservados", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "USER_ALREADY_EXISTS", message: "texto cru do servidor" },
    });
    setup();
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      'Já existe uma conta com este e-mail. Entre por "Entrar".',
    );
    expect(screen.queryByText("texto cru do servidor")).not.toBeInTheDocument();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.getByLabelText("Senha")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(email).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Nome")).toHaveValue("Ana Teste");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("senha curta: erro aponta para o campo de senha", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "PASSWORD_TOO_SHORT" },
    });
    setup();
    await fillAndSubmit();

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("código desconhecido cai no texto padrão, nunca no texto do servidor", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "COISA_NOVA", message: "stack trace" },
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.queryByText("stack trace")).not.toBeInTheDocument();
  });

  it("falha de rede (promessa rejeitada) mostra o texto padrão e libera o botão", async () => {
    mocks.signUpEmail.mockRejectedValue(new Error("Failed to fetch"));
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  it("trava o duplo clique: botão desabilitado e uma única criação enquanto pendente", async () => {
    let resolveSignUp: (value: unknown) => void = () => {};
    mocks.signUpEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      }),
    );
    setup();
    const user = await fillAndSubmit();

    const submit = screen.getByRole("button", { name: "Criar conta" });
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    await user.keyboard("{Enter}");
    expect(mocks.signUpEmail).toHaveBeenCalledTimes(1);
    expect(mocks.armInvite).toHaveBeenCalledTimes(1);

    resolveSignUp({ data: {}, error: null });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("mostra o erro inicial vindo de ?error= já traduzido", () => {
    setup({ initialErrorCode: "SIGNUP_INVITE_ONLY" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O cadastro é só por convite. Abra de novo o link que você recebeu.",
    );
  });

  it("erro inicial desconhecido vira o texto padrão", () => {
    setup({ initialErrorCode: "xyz" });
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("sem erro inicial não há alerta", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem provedores não mostra botões sociais", () => {
    setup({ providers: [] });
    expect(screen.queryByText(/Continuar com/)).not.toBeInTheDocument();
  });

  it("social: arma o convite e chama signIn.social com requestSignUp", async () => {
    setup({ providers: ["google", "facebook"] });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() => expect(mocks.signInSocial).toHaveBeenCalledTimes(1));
    expect(mocks.armInvite).toHaveBeenCalledWith(TOKEN);
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      requestSignUp: true,
      callbackURL: "/",
      newUserCallbackURL: "/bem-vindo",
      errorCallbackURL: `/convite/${TOKEN}`,
    });
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(mocks.armInvite.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signInSocial.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("social com Facebook usa o provedor certo", async () => {
    setup({ providers: ["facebook"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    );
    await waitFor(() => expect(mocks.signInSocial).toHaveBeenCalled());
    expect(mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "facebook", requestSignUp: true }),
    );
  });

  it("social com convite inválido: mostra o motivo e não inicia o OAuth", async () => {
    mocks.armInvite.mockResolvedValue({
      ok: false,
      message:
        "Este convite já foi usado. Peça um novo convite a quem te convidou.",
    });
    setup({ providers: ["google"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este convite já foi usado.",
    );
    expect(mocks.signInSocial).not.toHaveBeenCalled();
  });

  it("social com erro devolvido mostra a mensagem mapeada", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { code: "unable_to_create_user" },
    });
    setup({ providers: ["google"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar a conta. Tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  it("enquanto o cadastro está pendente os botões sociais ficam desabilitados", async () => {
    mocks.signUpEmail.mockReturnValue(new Promise(() => {}));
    setup({ providers: ["google"] });
    await fillAndSubmit();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continuar com Google" }),
      ).toBeDisabled(),
    );
  });
});
