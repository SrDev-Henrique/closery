import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ShiftRow } from "@/features/admin/shifts";
import { ShiftRowActions } from "./ShiftRowActions";

const mocks = vi.hoisted(() => ({
  createShiftAction: vi.fn(),
  updateShiftAction: vi.fn(),
  setShiftActiveAction: vi.fn(),
  moveShiftAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/turnos/actions", () => ({
  createShiftAction: mocks.createShiftAction,
  updateShiftAction: mocks.updateShiftAction,
  setShiftActiveAction: mocks.setShiftActiveAction,
  moveShiftAction: mocks.moveShiftAction,
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

const SHIFT: ShiftRow = {
  id: "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c",
  sectorId: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  name: "Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
  crossesMidnight: false,
  sortOrder: 2,
  active: true,
  canMoveUp: true,
  canMoveDown: true,
  overlaps: [],
};

function setup(shift: Partial<ShiftRow> = {}) {
  render(
    <TooltipProvider>
      <ShiftRowActions shift={{ ...SHIFT, ...shift }} />
    </TooltipProvider>,
  );
}

describe("ShiftRowActions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.moveShiftAction.mockResolvedValue({ ok: true });
  });

  it("primeiro da lista não sobe; último não desce", () => {
    setup({ canMoveUp: false });
    expect(screen.getByRole("button", { name: "Subir Manhã" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Manhã" })).toBeEnabled();
  });

  it("último da lista não desce", () => {
    setup({ canMoveDown: false });
    expect(screen.getByRole("button", { name: "Subir Manhã" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descer Manhã" })).toBeDisabled();
  });

  it("mostra o tooltip 'Subir' ao passar o mouse", async () => {
    setup();
    const up = screen.getByRole("button", { name: "Subir Manhã" });
    fireEvent.pointerEnter(up, { pointerType: "mouse" });
    fireEvent.mouseEnter(up);
    fireEvent.pointerMove(up, { pointerType: "mouse" });
    fireEvent.mouseMove(up);
    expect(await screen.findByText("Subir")).toBeInTheDocument();
  });

  it("descer chama a action sem toast de sucesso", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Descer Manhã" }));
    await waitFor(() =>
      expect(mocks.moveShiftAction).toHaveBeenCalledWith({
        id: SHIFT.id,
        direction: "down",
      }),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro ao mover aparece em toast", async () => {
    mocks.moveShiftAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Turno não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Subir Manhã" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Turno não encontrado. Atualize a página.",
      ),
    );
  });

  it("Editar abre o diálogo com o turno preenchido", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Manhã" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar turno" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do turno")).toHaveValue("Manhã");
    expect(screen.getByLabelText("Início")).toHaveValue("06:00");
    expect(screen.getByLabelText("Fim")).toHaveValue("14:00");
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeInTheDocument();
  });

  it("salvar a edição chama updateShiftAction e fecha o diálogo", async () => {
    mocks.updateShiftAction.mockResolvedValue({ ok: true, warnings: [] });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Manhã" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(mocks.updateShiftAction).toHaveBeenCalledWith({
        id: SHIFT.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Desativar chama a action e avisa 'Turno desativado.'", async () => {
    mocks.setShiftActiveAction.mockResolvedValue({ ok: true, warnings: [] });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Manhã" }),
    );
    await waitFor(() =>
      expect(mocks.setShiftActiveAction).toHaveBeenCalledWith({
        id: SHIFT.id,
        active: false,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno desativado.");
  });

  it("Reativar avisa a sobreposição e 'Turno reativado.'", async () => {
    mocks.setShiftActiveAction.mockResolvedValue({
      ok: true,
      warnings: [
        { shiftId: "x", name: "Tarde", startsAt: "12:00", endsAt: "20:00" },
      ],
    });
    setup({ active: false });
    await userEvent.click(
      screen.getByRole("button", { name: "Reativar Manhã" }),
    );
    await waitFor(() =>
      expect(mocks.toastWarning).toHaveBeenCalledWith(
        "Sobrepõe o turno Tarde (12:00–20:00)",
      ),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno reativado.");
  });

  it("falha ao desativar mostra o erro e não avisa sucesso", async () => {
    mocks.setShiftActiveAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Turno não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Manhã" }),
    );
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
