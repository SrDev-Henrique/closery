import { render, screen, within } from "@testing-library/react";
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

const ITEM_A = "44444444-4444-4444-8444-444444444444";
const ITEM_B = "55555555-5555-4555-8555-555555555555";
const ITEMS = [
  { id: ITEM_A, name: "Rede de proteção", unit: "rede", active: true },
  { id: ITEM_B, name: "Cinta antiga", unit: "peça", active: false },
];

describe("HistoryFilters: Entregues, Esperadas e Item", () => {
  beforeEach(() => mocks.push.mockReset());

  const options = (label: string) =>
    within(screen.getByLabelText(label))
      .getAllByRole("option")
      .map((option) => option.textContent);

  it("Situação: Entregues logo depois de Todas e Esperadas logo depois de Entregues", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    expect(options("Situação")).toEqual([
      "Todas",
      "Entregues",
      "Esperadas",
      "Aguardando",
      "Confirmada",
      "Não confirmada",
      "Sem passagem",
      "Corrigida",
    ]);
  });

  it("Entregues e Esperadas vão para a URL e voltam do parse", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    await user.selectOptions(screen.getByLabelText("Situação"), "delivered");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(mocks.push).toHaveBeenLastCalledWith(
      "/passagens?situacao=entregues",
    );

    await user.selectOptions(screen.getByLabelText("Situação"), "expected");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(mocks.push).toHaveBeenLastCalledWith(
      "/passagens?situacao=esperadas",
    );
  });

  it("começa com a situação da URL: entregues e esperadas", () => {
    const { unmount } = render(
      <HistoryFilters
        filters={parseHistoryFilters({ situacao: "entregues" }, "2026-11-21")}
        shifts={SHIFTS}
        sectorParam={null}
      />,
    );
    expect(screen.getByLabelText("Situação")).toHaveValue("delivered");
    unmount();

    render(
      <HistoryFilters
        filters={parseHistoryFilters({ situacao: "esperadas" }, "2026-11-21")}
        shifts={SHIFTS}
        sectorParam={null}
      />,
    );
    expect(screen.getByLabelText("Situação")).toHaveValue("expected");
  });

  it("Item só aparece com itens, logo depois de Turno, em 'Todos os itens' por padrão", () => {
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        items={ITEMS}
        sectorParam={null}
      />,
    );

    expect(screen.getByLabelText("Item")).toHaveValue("all");
    const labels = screen
      .getAllByRole("combobox")
      .map((select) => select.getAttribute("id"))
      .map((id) => document.querySelector(`label[for="${id}"]`)?.textContent);
    expect(labels.indexOf("Item")).toBe(labels.indexOf("Turno") + 1);
  });

  it("sem itens (ou em 'Todos os setores') o campo Item não aparece", () => {
    const { unmount } = render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );
    expect(screen.queryByLabelText("Item")).not.toBeInTheDocument();
    unmount();

    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={[]}
        items={[]}
        sectorParam="todos"
      />,
    );
    expect(screen.queryByLabelText("Item")).not.toBeInTheDocument();
  });

  it("opções do Item: 'Todos os itens' e '{nome} ({unidade})', com '(inativo)' no desativado", () => {
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        items={ITEMS}
        sectorParam={null}
      />,
    );

    expect(options("Item")).toEqual([
      "Todos os itens",
      "Rede de proteção (rede)",
      "Cinta antiga (peça) (inativo)",
    ]);
  });

  it("item inativo escolhido pela URL aparece selecionado, nunca 'Todos os itens' (C-4)", () => {
    render(
      <HistoryFilters
        filters={parseHistoryFilters({ item: ITEM_B }, "2026-11-21")}
        shifts={SHIFTS}
        items={ITEMS}
        sectorParam={null}
      />,
    );

    const select = screen.getByLabelText("Item");
    expect(select).toHaveValue(ITEM_B);
    expect(
      within(select).getByRole("option", {
        name: "Cinta antiga (peça) (inativo)",
        selected: true,
      }),
    ).toBeInTheDocument();
  });

  it("turno inativo escolhido pela URL aparece selecionado como '{nome} (inativo)' (C-4)", () => {
    render(
      <HistoryFilters
        filters={parseHistoryFilters({ turno: SHIFT_B }, "2026-11-21")}
        shifts={[
          {
            id: SHIFT_A,
            name: "Turno Manhã",
            startsAt: "06:00",
            endsAt: "14:00",
          },
          {
            id: SHIFT_B,
            name: "Turno Noite",
            startsAt: "22:00",
            endsAt: "06:00",
            active: false,
          },
        ]}
        sectorParam={null}
      />,
    );

    const select = screen.getByLabelText("Turno");
    expect(select).toHaveValue(SHIFT_B);
    expect(
      within(select).getByRole("option", {
        name: "Turno Noite (inativo)",
        selected: true,
      }),
    ).toBeInTheDocument();
    expect(options("Turno")).toEqual([
      "Todos os turnos",
      "Turno Manhã",
      "Turno Noite (inativo)",
    ]);
  });

  it("turnos sem a propriedade active continuam sem '(inativo)'", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    expect(options("Turno")).toEqual([
      "Todos os turnos",
      "Turno Manhã",
      "Turno Noite",
    ]);
  });

  it("Aplicar filtros leva o item e o turno para a URL (volta à página 1)", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        items={ITEMS}
        sectorParam={SECTOR}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Turno"), SHIFT_A);
    await user.selectOptions(screen.getByLabelText("Situação"), "delivered");
    await user.selectOptions(screen.getByLabelText("Item"), ITEM_A);
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      `/passagens?turno=${SHIFT_A}&situacao=entregues&item=${ITEM_A}&setor=${SECTOR}`,
    );
  });

  it("voltar o Item para 'Todos os itens' tira o item da URL", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters
        filters={parseHistoryFilters({ item: ITEM_A }, "2026-11-21")}
        shifts={SHIFTS}
        items={ITEMS}
        sectorParam={null}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Item"), "all");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/passagens");
  });
});
