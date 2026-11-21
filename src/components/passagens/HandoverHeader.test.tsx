import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HandoverHeader } from "./HandoverHeader";

const mocks = vi.hoisted(() => ({ push: vi.fn(), toastError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const MANHA = "22222222-2222-4222-8222-222222222222";
const TARDE = "33333333-3333-4333-8333-333333333333";
const SHIFTS = [
  { id: MANHA, name: "Turno Manhã", startsAt: "06:00", endsAt: "14:00" },
  { id: TARDE, name: "Turno Tarde", startsAt: "14:00", endsAt: "22:00" },
];

function setup(props: Partial<Parameters<typeof HandoverHeader>[0]> = {}) {
  render(
    <HandoverHeader
      sectorId={SECTOR_ID}
      sectorName="ULD"
      shifts={SHIFTS}
      shiftId={MANHA}
      operationalDate="2026-11-20"
      today="2026-11-20"
      minDate="2026-10-20"
      sectorParam={null}
      beforeNavigate={vi.fn().mockResolvedValue(true)}
      {...props}
    />,
  );
}

describe("HandoverHeader", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o setor em texto, o turno escolhido e a data", () => {
    setup();

    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("ULD")).toBeInTheDocument();
    expect(screen.getByLabelText("Turno")).toHaveValue(MANHA);
    expect(
      screen.getByRole("option", { name: "Turno Tarde (14:00–22:00)" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-20");
  });

  it("a data só aceita de hoje até 31 dias atrás (min e max do campo)", () => {
    setup();

    expect(screen.getByLabelText("Data")).toHaveAttribute("min", "2026-10-20");
    expect(screen.getByLabelText("Data")).toHaveAttribute("max", "2026-11-20");
  });

  it("trocar o turno salva e navega mantendo a data", async () => {
    const beforeNavigate = vi.fn().mockResolvedValue(true);
    setup({ beforeNavigate });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${TARDE}&data=2026-11-20`,
      ),
    );
    expect(beforeNavigate).toHaveBeenCalledTimes(1);
  });

  it("trocar a data navega mantendo o turno", async () => {
    setup();

    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-11-19" },
    });
    fireEvent.blur(screen.getByLabelText("Data"));

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${MANHA}&data=2026-11-19`,
      ),
    );
  });

  it("digitar uma data parcial não navega; sair do campo navega uma vez com a data completa", async () => {
    setup();
    const date = screen.getByLabelText("Data");

    // Digitando o dia "15": depois do "1" o navegador já emite uma data válida.
    fireEvent.change(date, { target: { value: "2026-11-01" } });
    expect(date).toHaveValue("2026-11-01");
    expect(mocks.push).not.toHaveBeenCalled();
    fireEvent.change(date, { target: { value: "2026-11-15" } });
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.blur(date);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(mocks.push).toHaveBeenCalledWith(
      `/passagens/nova?turno=${MANHA}&data=2026-11-15`,
    );
  });

  it("Enter confirma a data digitada", async () => {
    setup();
    const date = screen.getByLabelText("Data");

    fireEvent.change(date, { target: { value: "2026-11-18" } });
    fireEvent.keyDown(date, { key: "Enter" });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
    expect(mocks.push).toHaveBeenCalledWith(
      `/passagens/nova?turno=${MANHA}&data=2026-11-18`,
    );
  });

  it("o admin leva o setor na URL", async () => {
    setup({ sectorParam: SECTOR_ID });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${TARDE}&data=2026-11-20&setor=${SECTOR_ID}`,
      ),
    );
  });

  it("se não conseguir salvar, não navega e avisa", async () => {
    setup({ beforeNavigate: vi.fn().mockResolvedValue(false) });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível salvar. Tente de novo antes de trocar de turno.",
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Turno")).toHaveValue(MANHA);
  });

  it("sem beforeNavigate navega direto", async () => {
    setup({ beforeNavigate: undefined });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("data futura, antiga demais ou vazia é ignorada", () => {
    setup();
    const date = screen.getByLabelText("Data");

    for (const value of ["2026-11-21", "2026-10-19", ""]) {
      fireEvent.change(date, { target: { value } });
      fireEvent.blur(date);
    }

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("escolher o que já está escolhido não navega", async () => {
    setup();

    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.blur(screen.getByLabelText("Data"));
    await userEvent.selectOptions(screen.getByLabelText("Turno"), MANHA);

    expect(mocks.push).not.toHaveBeenCalled();
  });
});
