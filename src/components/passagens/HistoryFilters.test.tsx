import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type HistoryFilters as Filters,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { HistoryFilters } from "./HistoryFilters";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const SHIFT_A = "11111111-1111-4111-8111-111111111111";
const SHIFT_B = "22222222-2222-4222-8222-222222222222";
const SECTOR = "33333333-3333-4333-8333-333333333333";
const SHIFTS = [
  { id: SHIFT_A, name: "Turno Manhã", startsAt: "06:00", endsAt: "14:00" },
  { id: SHIFT_B, name: "Turno Noite", startsAt: "22:00", endsAt: "06:00" },
];

const DEFAULTS: Filters = parseHistoryFilters({}, "2026-11-21");

describe("HistoryFilters", () => {
  beforeEach(() => mocks.push.mockReset());

  it("nunca começa em branco: período 7 dias, todos os turnos, todas as situações", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    expect(screen.getByLabelText("Período")).toHaveValue("7");
    expect(screen.getByLabelText("Turno")).toHaveValue("all");
    expect(screen.getByLabelText("Situação")).toHaveValue("all");
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Até")).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Todos os turnos" }),
    ).toBeInTheDocument();
  });

  it("começa com o que a URL já escolheu", () => {
    render(
      <HistoryFilters
        filters={parseHistoryFilters(
          {
            periodo: "intervalo",
            de: "2026-11-01",
            ate: "2026-11-10",
            turno: SHIFT_B,
            situacao: "nao-confirmada",
          },
          "2026-11-21",
        )}
        shifts={SHIFTS}
        sectorParam={null}
      />,
    );

    expect(screen.getByLabelText("Período")).toHaveValue("range");
    expect(screen.getByLabelText("De")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-11-10");
    expect(screen.getByLabelText("Turno")).toHaveValue(SHIFT_B);
    expect(screen.getByLabelText("Situação")).toHaveValue("unconfirmed");
  });

  it("'Todos os setores' (sem turnos para escolher): o campo Turno não aparece", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={[]} sectorParam="todos" />,
    );
    expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Período")).toBeInTheDocument();
  });

  it("escolher Intervalo mostra De e Até já preenchidos com os últimos 7 dias", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    await user.selectOptions(screen.getByLabelText("Período"), "range");

    expect(screen.getByLabelText("De")).toHaveValue("2026-11-15");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-11-21");
  });

  it("'Aplicar filtros' navega para a URL dos filtros (volta à página 1)", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    await user.selectOptions(screen.getByLabelText("Período"), "30");
    await user.selectOptions(screen.getByLabelText("Turno"), SHIFT_A);
    await user.selectOptions(screen.getByLabelText("Situação"), "missing");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith(
      `/passagens?periodo=30&turno=${SHIFT_A}&situacao=sem-passagem`,
    );
  });

  it("o intervalo digitado vai na URL e o setor do admin é preservado", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        sectorParam={SECTOR}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Período"), "range");
    await user.clear(screen.getByLabelText("De"));
    await user.type(screen.getByLabelText("De"), "2026-11-01");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mocks.push).toHaveBeenCalledWith(
      `/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-21&setor=${SECTOR}`,
    );
  });

  it("aplicar sem mexer em nada vai para o histórico padrão", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(mocks.push).toHaveBeenCalledWith("/passagens");
  });

  it("'Limpar filtros' é um link para o histórico sem filtros", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/passagens");
  });

  it("'Limpar filtros' preserva só o setor do admin", () => {
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        sectorParam={SECTOR}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", `/passagens?setor=${SECTOR}`);
  });
});
