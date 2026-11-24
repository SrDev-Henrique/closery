import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { InviteForm } from "./InviteForm";

const mocks = vi.hoisted(() => ({
  createInviteAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  createInviteAction: mocks.createInviteAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR_A: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
};
const SECTOR_B: SectorChoice = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Recebimento",
};
const LINK = "https://closery.example.test/convite/token-de-teste";
const EXPIRES_AT = new Date("2026-11-28T17:30:00.000Z");
const LABEL = "Nome de referência (opcional)";

function setup(sectors: SectorChoice[] = [SECTOR_A, SECTOR_B]) {
  const user = userEvent.setup();
  render(<InviteForm sectors={sectors} />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createInviteAction.mockResolvedValue({
    ok: true,
    id: "convite-1",
    url: LINK,
    expiresAt: EXPIRES_AT,
  });
});

describe("InviteForm", () => {
  it("nunca começa em branco: Operador e o primeiro setor já escolhidos", () => {
    setup();

    expect(screen.getByText("Convidar pessoa")).toBeInTheDocument();
    expect(screen.getByLabelText(LABEL)).toHaveValue("");
    expect(
      screen.getByText("Só para você reconhecer o convite na lista."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    expect(screen.getByRole("button", { name: "Gerar convite" })).toBeEnabled();
  });

  it("gera o convite de operador e mostra o link no lugar do formulário", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(LABEL), "Maria do Turno");
    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(
      await screen.findByRole("heading", { name: "Convite gerado" }),
    ).toBeInTheDocument();
    expect(mocks.createInviteAction).toHaveBeenCalledWith({
      inviteeLabel: "Maria do Turno",
      role: "operator",
      sectorId: SECTOR_B.id,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Convite gerado.");
    expect(screen.getByLabelText("Link do convite")).toHaveValue(LINK);
    expect(
      screen.queryByRole("button", { name: "Gerar convite" }),
    ).not.toBeInTheDocument();
  });

  it("Administrador esconde o setor e envia setor nulo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Administrador" }));
    expect(screen.queryByLabelText("Setor")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await waitFor(() =>
      expect(mocks.createInviteAction).toHaveBeenCalledWith({
        inviteeLabel: "",
        role: "admin",
        sectorId: null,
      }),
    );
  });

  it("Gerar outro convite volta ao formulário, limpa o nome e mantém papel e setor", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(LABEL), "Maria");
    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await user.click(
      await screen.findByRole("button", { name: "Gerar outro convite" }),
    );

    expect(screen.getByLabelText(LABEL)).toHaveValue("");
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_B.id);
    expect(
      screen.queryByRole("heading", { name: "Convite gerado" }),
    ).not.toBeInTheDocument();
  });

  it("'Convidar pessoa' é o título (h2) do cartão", () => {
    setup();

    expect(
      screen.getByRole("heading", { level: 2, name: "Convidar pessoa" }),
    ).toBeInTheDocument();
  });

  it("ao gerar o convite o foco vai para o título 'Convite gerado'", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    const title = await screen.findByRole("heading", {
      level: 3,
      name: "Convite gerado",
    });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it("'Gerar outro convite' devolve o foco ao campo do nome de referência", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await user.click(
      await screen.findByRole("button", { name: "Gerar outro convite" }),
    );

    await waitFor(() => expect(screen.getByLabelText(LABEL)).toHaveFocus());
  });

  it("recusa do servidor não rouba o foco do formulário", async () => {
    mocks.createInviteAction.mockResolvedValue(
      fail("SECTOR_INACTIVE", "Este setor está inativo. Escolha outro.", {
        sectorId: "Este setor está inativo. Escolha outro.",
      }),
    );
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText(LABEL)).not.toHaveFocus();
    expect(
      screen.queryByRole("heading", { name: "Convite gerado" }),
    ).not.toBeInTheDocument();
  });

  it("nome de referência acima de 80 caracteres: recusa no cliente", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText(LABEL));
    await user.paste("a".repeat(81));
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome de referência pode ter no máximo 80 caracteres.",
    );
    expect(mocks.createInviteAction).not.toHaveBeenCalled();
  });

  it("80 caracteres exatos passam", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText(LABEL));
    await user.paste("a".repeat(80));
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await waitFor(() =>
      expect(mocks.createInviteAction).toHaveBeenCalledTimes(1),
    );
  });

  it("recusa do servidor no campo setor aparece nele e preserva o que foi digitado", async () => {
    mocks.createInviteAction.mockResolvedValue(
      fail("SECTOR_INACTIVE", "Este setor está inativo. Escolha outro.", {
        sectorId: "Este setor está inativo. Escolha outro.",
      }),
    );
    const { user } = setup();

    await user.type(screen.getByLabelText(LABEL), "Maria");
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Escolha outro.",
    );
    expect(screen.getByLabelText(LABEL)).toHaveValue("Maria");
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    expect(
      screen.queryByRole("heading", { name: "Convite gerado" }),
    ).not.toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("lista de setores trocada: mostra e envia o primeiro setor disponível", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InviteForm sectors={[SECTOR_A, SECTOR_B]} />);
    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);

    rerender(<InviteForm sectors={[SECTOR_A]} />);

    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    await waitFor(() =>
      expect(mocks.createInviteAction).toHaveBeenCalledWith({
        inviteeLabel: "",
        role: "operator",
        sectorId: SECTOR_A.id,
      }),
    );
  });

  it("setor que só aparece depois do carregamento é enviado, não nulo", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InviteForm sectors={[]} />);

    rerender(<InviteForm sectors={[SECTOR_B]} />);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await waitFor(() =>
      expect(mocks.createInviteAction).toHaveBeenCalledWith({
        inviteeLabel: "",
        role: "operator",
        sectorId: SECTOR_B.id,
      }),
    );
  });

  it("o link gerado sobrevive a um rerender com props novas (F2-20)", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<InviteForm sectors={[SECTOR_A, SECTOR_B]} />);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));
    expect(await screen.findByLabelText("Link do convite")).toHaveValue(LINK);

    rerender(<InviteForm sectors={[SECTOR_B]} />);

    expect(screen.getByLabelText("Link do convite")).toHaveValue(LINK);
  });

  it("erro do servidor em campo que o formulário não desenha aparece no pé", async () => {
    mocks.createInviteAction.mockResolvedValue(
      fail("INVALID_INPUT", "Convite recusado pelo servidor.", {
        role: "Papel inválido.",
      }),
    );
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Convite recusado pelo servidor.",
    );
  });

  it("erro inesperado vira a mensagem padrão no formulário", async () => {
    mocks.createInviteAction.mockRejectedValue(new Error("rede"));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Gerar convite" })).toBeEnabled();
  });

  it("sem setor ativo: explica, leva a Setores e não oferece gerar para operador", async () => {
    const { user } = setup([]);

    expect(
      screen.getByText("Cadastre um setor antes de convidar um operador."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(
      screen.queryByRole("button", { name: "Gerar convite" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Administrador" }));

    expect(
      screen.queryByRole("link", { name: "Ir para Setores" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar convite" }),
    ).toBeInTheDocument();
  });

  it("trava o botão enquanto gera e não envia duas vezes", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createInviteAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup();
    const submit = screen.getByRole("button", { name: "Gerar convite" });

    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(mocks.createInviteAction).toHaveBeenCalledTimes(1);

    finish({ ok: true, id: "c", url: LINK, expiresAt: EXPIRES_AT });
    expect(
      await screen.findByRole("heading", { name: "Convite gerado" }),
    ).toBeInTheDocument();
  });
});
