import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShiftForm } from "./ShiftForm";

const SECTOR_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const SHIFT_ID = "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c";

const mocks = vi.hoisted(() => ({
  createShiftAction: vi.fn(),
  updateShiftAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/turnos/actions", () => ({
  createShiftAction: mocks.createShiftAction,
  updateShiftAction: mocks.updateShiftAction,
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

const DEFAULTS = { name: "Turno 2", startsAt: "14:00", endsAt: "22:00" };

function setup(props: Partial<ComponentProps<typeof ShiftForm>> = {}) {
  const onDone = vi.fn();
  render(
    <ShiftForm
      sectorId={SECTOR_ID}
      initial={DEFAULTS}
      submitLabel="Criar turno"
      onDone={onDone}
      {...props}
    />,
  );
  return { onDone };
}

const nameField = () => screen.getByLabelText("Nome do turno");
const startField = () => screen.getByLabelText("Início");
const endField = () => screen.getByLabelText("Fim");
const submit = () => screen.getByRole("button", { name: "Criar turno" });

describe("ShiftForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("nunca começa em branco: traz nome, início e fim sugeridos", () => {
    setup();
    expect(nameField()).toHaveValue("Turno 2");
    expect(startField()).toHaveValue("14:00");
    expect(endField()).toHaveValue("22:00");
    expect(
      screen.getByText("Fim menor que o início atravessa a meia-noite."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Atravessa a meia-noite."),
    ).not.toBeInTheDocument();
  });

  it("mostra a dica ao vivo quando o fim é menor que o início", () => {
    setup();
    fireEvent.change(startField(), { target: { value: "22:00" } });
    fireEvent.change(endField(), { target: { value: "06:00" } });
    expect(screen.getByText("Atravessa a meia-noite.")).toBeInTheDocument();
    fireEvent.change(endField(), { target: { value: "23:00" } });
    expect(
      screen.queryByText("Atravessa a meia-noite."),
    ).not.toBeInTheDocument();
  });

  it("criar: chama a action com os valores, avisa e entrega onDone", async () => {
    mocks.createShiftAction.mockResolvedValue({
      ok: true,
      id: "x",
      warnings: [],
    });
    const { onDone } = setup();

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Tarde longa");
    await userEvent.click(submit());

    await waitFor(() =>
      expect(mocks.createShiftAction).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        name: "Tarde longa",
        startsAt: "14:00",
        endsAt: "22:00",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno criado.");
    expect(mocks.toastWarning).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("mostra um toast de aviso por sobreposição, no máximo três", async () => {
    const warnings = ["A", "B", "C", "D"].map((name) => ({
      shiftId: `id-${name}`,
      name,
      startsAt: "06:00",
      endsAt: "14:00",
    }));
    mocks.createShiftAction.mockResolvedValue({ ok: true, id: "x", warnings });
    setup();

    await userEvent.click(submit());

    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalledTimes(3));
    expect(mocks.toastWarning).toHaveBeenNthCalledWith(
      1,
      "Sobrepõe o turno A (06:00–14:00)",
    );
  });

  it("nome vazio: erro no campo, sem chamar a action", async () => {
    setup();
    await userEvent.clear(nameField());
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
  });

  it("início igual ao fim: erro no campo Fim, sem chamar a action", async () => {
    setup();
    fireEvent.change(endField(), { target: { value: "14:00" } });
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O início e o fim não podem ser iguais.",
    );
    expect(endField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
  });

  it("horário apagado: erro no campo Início", async () => {
    setup();
    fireEvent.change(startField(), { target: { value: "" } });
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe um horário válido, como 06:00.",
    );
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
  });

  it("recusa do servidor: mostra o erro no campo e preserva o digitado", async () => {
    mocks.createShiftAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um turno com este nome neste setor.",
      fieldErrors: { name: "Já existe um turno com este nome neste setor." },
    });
    const { onDone } = setup();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Manhã");
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um turno com este nome neste setor.",
    );
    expect(nameField()).toHaveValue("Manhã");
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro sem campo (setor inativo) aparece no formulário", async () => {
    mocks.createShiftAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: "Este setor está inativo. Reative-o para cadastrar turnos.",
    });
    setup();
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Reative-o para cadastrar turnos.",
    );
  });

  it("falha de rede vira a mensagem genérica no formulário", async () => {
    mocks.createShiftAction.mockRejectedValue(new Error("fetch failed"));
    setup();
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.queryByText("fetch failed")).not.toBeInTheDocument();
  });

  it("trava o botão enquanto a action está em andamento", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createShiftAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    await userEvent.click(submit());
    expect(submit()).toBeDisabled();
    finish({ ok: true, id: "x", warnings: [] });
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("editar: chama updateShiftAction com o id e avisa 'Alterações salvas.'", async () => {
    mocks.updateShiftAction.mockResolvedValue({ ok: true, warnings: [] });
    const { onDone } = setup({
      initial: { id: SHIFT_ID, ...DEFAULTS },
      submitLabel: "Salvar alterações",
    });

    fireEvent.change(endField(), { target: { value: "23:00" } });
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.updateShiftAction).toHaveBeenCalledWith({
        id: SHIFT_ID,
        name: "Turno 2",
        startsAt: "14:00",
        endsAt: "23:00",
      }),
    );
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas.");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
