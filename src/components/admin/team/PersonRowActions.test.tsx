import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonRow } from "@/features/admin/people";
import { fail } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { PersonRowActions } from "./PersonRowActions";

const mocks = vi.hoisted(() => ({
  setPersonActiveAction: vi.fn(),
  updatePersonAction: vi.fn(),
  createPasswordResetLinkAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  setPersonActiveAction: mocks.setPersonActiveAction,
  updatePersonAction: mocks.updatePersonAction,
  createPasswordResetLinkAction: mocks.createPasswordResetLinkAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
  color: "lilac",
};

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR.id,
    sectorName: SECTOR.name,
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function setup(row: PersonRow = person()) {
  const user = userEvent.setup();
  render(<PersonRowActions person={row} sectors={[SECTOR]} />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setPersonActiveAction.mockResolvedValue({ ok: true });
  mocks.updatePersonAction.mockResolvedValue({ ok: true });
});

describe("PersonRowActions", () => {
  it("pessoa ativa: Editar e Desativar, sem Reativar", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "Editar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reativar Bruno Fictício" }),
    ).not.toBeInTheDocument();
  });

  it("pessoa ativa tem Nova senha entre Editar e Desativar; inativa não tem", () => {
    const { unmount } = render(
      <PersonRowActions person={person()} sectors={[SECTOR]} />,
    );
    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar Bruno Fictício",
      "Gerar link de nova senha para Bruno Fictício",
      "Desativar Bruno Fictício",
    ]);
    unmount();

    render(
      <PersonRowActions
        person={person({ active: false })}
        sectors={[SECTOR]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Gerar link de nova senha/ }),
    ).not.toBeInTheDocument();
  });

  it("Nova senha chama a action com o id da pessoa e mostra o link", async () => {
    mocks.createPasswordResetLinkAction.mockResolvedValue({
      ok: true,
      url: "https://closery.example.test/redefinir-senha#token=abc",
      expiresAt: new Date("2026-11-26T12:00:00.000Z"),
    });
    const { user } = setup();

    await user.click(
      screen.getByRole("button", {
        name: "Gerar link de nova senha para Bruno Fictício",
      }),
    );

    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledWith({
      userId: "pessoa-1",
    });
    expect(await screen.findByLabelText("Link para copiar")).toHaveValue(
      "https://closery.example.test/redefinir-senha#token=abc",
    );
  });

  it("pessoa inativa: Editar e Reativar, sem Desativar", () => {
    setup(person({ active: false }));

    expect(
      screen.getByRole("button", { name: "Reativar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar Bruno Fictício" }),
    ).not.toBeInTheDocument();
  });

  it("Editar abre o diálogo com o nome da pessoa e o formulário", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Editar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Editar pessoa" });
    expect(within(dialog).getByText("Bruno Fictício")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    ).toBeInTheDocument();
  });

  it("salvar a edição fecha o diálogo", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Editar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Editar pessoa" });
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Editar pessoa" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("Desativar pede confirmação com o texto exato e só então age", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Desativar Bruno Fictício?",
    });
    expect(
      within(dialog).getByText(
        "A pessoa perde o acesso agora e as sessões abertas são encerradas. O histórico dela continua. Você pode reativar depois.",
      ),
    ).toBeInTheDocument();
    expect(mocks.setPersonActiveAction).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(mocks.setPersonActiveAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        active: false,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Pessoa desativada.");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Voltar fecha a confirmação sem desativar", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.setPersonActiveAction).not.toHaveBeenCalled();
  });

  it("recusa do servidor aparece no diálogo, que continua aberto, sem toast", async () => {
    mocks.setPersonActiveAction.mockResolvedValue(
      fail(
        "LAST_ADMIN",
        "Este é o último administrador ativo. Nomeie outro antes.",
      ),
    );
    const { user } = setup(person({ role: "admin", sectorId: null }));
    await user.click(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("Reativar age direto e avisa", async () => {
    const { user } = setup(person({ active: false }));

    await user.click(
      screen.getByRole("button", { name: "Reativar Bruno Fictício" }),
    );

    await waitFor(() =>
      expect(mocks.setPersonActiveAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        active: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Pessoa reativada.");
  });

  it("Reativar recusado mostra o motivo num toast", async () => {
    mocks.setPersonActiveAction.mockResolvedValue(
      fail(
        "SECTOR_INACTIVE",
        "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
      ),
    );
    const { user } = setup(person({ active: false }));

    await user.click(
      screen.getByRole("button", { name: "Reativar Bruno Fictício" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
