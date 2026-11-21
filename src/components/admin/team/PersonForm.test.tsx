import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonRow } from "@/features/admin/people";
import { fail } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { PersonForm } from "./PersonForm";

const mocks = vi.hoisted(() => ({
  updatePersonAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: mocks.updatePersonAction,
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

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR_A.id,
    sectorName: SECTOR_A.name,
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function setup(
  props: { person?: PersonRow; sectors?: SectorChoice[] } = {},
  onDone = vi.fn(),
) {
  const user = userEvent.setup();
  render(
    <PersonForm
      person={props.person ?? person()}
      sectors={props.sectors ?? [SECTOR_A, SECTOR_B]}
      onDone={onDone}
    />,
  );
  return { user, onDone };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updatePersonAction.mockResolvedValue({ ok: true });
});

describe("PersonForm", () => {
  it("começa com o papel e o setor atuais, nunca em branco", () => {
    setup();

    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
  });

  it("salvar sem mexer envia os valores atuais", async () => {
    const { user, onDone } = setup();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(mocks.updatePersonAction).toHaveBeenCalledWith({
      userId: "pessoa-1",
      role: "operator",
      sectorId: SECTOR_A.id,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas.");
  });

  it("troca o setor e envia o novo", async () => {
    const { user } = setup();

    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mocks.updatePersonAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        role: "operator",
        sectorId: SECTOR_B.id,
      }),
    );
  });

  it("virar Administrador esconde o setor, explica e envia setor nulo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Administrador" }));

    expect(screen.queryByLabelText("Setor")).not.toBeInTheDocument();
    expect(
      screen.getByText("Administradores veem todos os setores."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(mocks.updatePersonAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        role: "admin",
        sectorId: null,
      }),
    );
  });

  it("administrador que volta a Operador já vem com o primeiro setor", async () => {
    const { user } = setup({
      person: person({
        role: "admin",
        sectorId: null,
        sectorName: null,
        sectorActive: null,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Operador" }));

    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
  });

  it("setor atual inativo (fora da lista) cai no primeiro setor ativo", () => {
    setup({
      person: person({ sectorId: "outro-id", sectorActive: false }),
    });
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
  });

  it("clicar no papel já escolhido não o desmarca", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Operador" }));

    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("operador sem nenhum setor ativo: recusa no cliente e não chama a action", async () => {
    const { user, onDone } = setup({ sectors: [] });

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Escolha o setor do operador.",
    );
    expect(mocks.updatePersonAction).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("recusa do servidor com erro de campo aparece no setor e preserva a escolha", async () => {
    mocks.updatePersonAction.mockResolvedValue(
      fail("SECTOR_INACTIVE", "Este setor está inativo. Escolha outro.", {
        sectorId: "Este setor está inativo. Escolha outro.",
      }),
    );
    const { user, onDone } = setup();

    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Escolha outro.",
    );
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_B.id);
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("erro do servidor em campo que o formulário não desenha aparece no pé", async () => {
    mocks.updatePersonAction.mockResolvedValue(
      fail("NOT_FOUND", "Pessoa não encontrada.", {
        userId: "Pessoa não encontrada.",
      }),
    );
    const { user, onDone } = setup();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Pessoa não encontrada.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("recusa sem campo (último admin) aparece no pé do formulário", async () => {
    mocks.updatePersonAction.mockResolvedValue(
      fail(
        "LAST_ADMIN",
        "Este é o último administrador ativo. Nomeie outro antes.",
      ),
    );
    const { user, onDone } = setup({
      person: person({
        role: "admin",
        sectorId: null,
        sectorName: null,
        sectorActive: null,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Operador" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("erro inesperado de rede vira a mensagem padrão, sem fechar", async () => {
    mocks.updatePersonAction.mockRejectedValue(new Error("falhou"));
    const { user, onDone } = setup();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("trava o botão enquanto a action não responde e não envia duas vezes", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    mocks.updatePersonAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup();
    const submit = screen.getByRole("button", { name: "Salvar alterações" });

    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(mocks.updatePersonAction).toHaveBeenCalledTimes(1);

    finish({ ok: true });
    await waitFor(() => expect(submit).toBeEnabled());
  });
});
