import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PasskeyManager } from "./PasskeyManager";

type ListState = {
  data: { id: string; name: string | null; createdAt: string | null }[] | null;
  isPending: boolean;
  error: { message?: string } | null;
  refetch: () => void;
};

const mocks = vi.hoisted(() => ({
  useListPasskeys: vi.fn(),
  addPasskey: vi.fn(),
  deletePasskey: vi.fn(),
  refetch: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useListPasskeys: mocks.useListPasskeys,
    passkey: {
      addPasskey: mocks.addPasskey,
      deletePasskey: mocks.deletePasskey,
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

const FALLBACK = "Não foi possível concluir. Tente de novo.";

function listState(overrides: Partial<ListState> = {}): ListState {
  return {
    data: [],
    isPending: false,
    error: null,
    refetch: mocks.refetch,
    ...overrides,
  };
}

function setup(state: ListState = listState()) {
  mocks.useListPasskeys.mockReturnValue(state);
  return render(
    <TooltipProvider>
      <PasskeyManager />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.addPasskey.mockResolvedValue({ data: {}, error: null });
  mocks.deletePasskey.mockResolvedValue({
    data: { status: true },
    error: null,
  });
});

describe("PasskeyManager", () => {
  it("mostra a seção, o estado vazio e o botão de criar", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Passkeys" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhuma passkey ainda.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar passkey" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("carregando: mostra esqueleto e não afirma que está vazio", () => {
    setup(listState({ data: null, isPending: true }));
    expect(
      screen.queryByText("Nenhuma passkey ainda."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("passkeys-loading")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("lista nome e data de criação em pt-BR", () => {
    setup(
      listState({
        data: [
          { id: "p1", name: "Notebook", createdAt: "2026-03-15T15:00:00.000Z" },
          { id: "p2", name: null, createdAt: null },
        ],
      }),
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText("Notebook")).toBeVisible();
    expect(
      within(items[0] as HTMLElement).getByText(/15 de mar\. de 2026/),
    ).toBeVisible();
    // Sem nome e sem data: rótulo padrão, sem inventar data.
    expect(within(items[1] as HTMLElement).getByText("Passkey")).toBeVisible();
    expect(
      screen.queryByText("Nenhuma passkey ainda."),
    ).not.toBeInTheDocument();
  });

  it("falha ao carregar: mostra o texto padrão e permite tentar de novo", async () => {
    setup(listState({ data: null, error: { message: "texto cru" } }));
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.queryByText("texto cru")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("criar passkey: avisa com toast e fica na tela", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey criada."),
    );
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
  });

  it("criar passkey com erro mostra a mensagem mapeada, sem toast", async () => {
    mocks.addPasskey.mockResolvedValue({
      data: null,
      error: { code: "SESSION_NOT_FRESH", message: "texto cru" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Por segurança, entre de novo antes de criar uma passkey.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar passkey" })).toBeEnabled();
  });

  it("cancelar o diálogo do WebAuthn mostra 'Criação da passkey cancelada.'", async () => {
    // Código real do @simplewebauthn/browser para NotAllowedError (T14).
    mocks.addPasskey.mockResolvedValue({
      data: null,
      error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", message: "x" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Criação da passkey cancelada.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("criar passkey que lança exceção usa o texto padrão", async () => {
    mocks.addPasskey.mockRejectedValue(new Error("boom"));
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("trava o duplo clique ao criar", async () => {
    mocks.addPasskey.mockReturnValue(new Promise(() => {}));
    setup();
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Criar passkey" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
  });

  it("remover: botão de ícone com aria-label, chama deletePasskey e avisa", async () => {
    setup(
      listState({
        data: [{ id: "p1", name: "Notebook", createdAt: null }],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover passkey" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey removida."),
    );
    expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "p1" });
  });

  it("remover mostra o tooltip 'Remover passkey' ao passar o mouse", async () => {
    setup(
      listState({ data: [{ id: "p1", name: "Notebook", createdAt: null }] }),
    );
    const button = screen.getByRole("button", { name: "Remover passkey" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.mouseEnter(button);
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    fireEvent.mouseMove(button);
    expect(await screen.findByText("Remover passkey")).toBeVisible();
  });

  it("remover só afeta o item clicado", async () => {
    setup(
      listState({
        data: [
          { id: "p1", name: "Notebook", createdAt: null },
          { id: "p2", name: "Celular", createdAt: null },
        ],
      }),
    );
    const items = screen.getAllByRole("listitem");
    await userEvent.click(
      within(items[1] as HTMLElement).getByRole("button", {
        name: "Remover passkey",
      }),
    );
    await waitFor(() => expect(mocks.deletePasskey).toHaveBeenCalled());
    expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "p2" });
    expect(mocks.deletePasskey).toHaveBeenCalledTimes(1);
  });

  it("remover com erro mostra a mensagem mapeada, sem toast", async () => {
    mocks.deletePasskey.mockResolvedValue({
      data: null,
      error: { code: "PASSKEY_NOT_FOUND", message: "texto cru" },
    });
    setup(
      listState({ data: [{ id: "p1", name: "Notebook", createdAt: null }] }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passkey não encontrada.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Remover passkey" }),
    ).toBeEnabled();
  });

  it("trava o duplo clique ao remover", async () => {
    mocks.deletePasskey.mockReturnValue(new Promise(() => {}));
    setup(
      listState({ data: [{ id: "p1", name: "Notebook", createdAt: null }] }),
    );
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Remover passkey" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.deletePasskey).toHaveBeenCalledTimes(1);
  });
});
