import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { HistoryPeriodRange } from "@/features/handovers/historyFilters";
import { DashboardPeriodPicker } from "./DashboardPeriodPicker";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

const TODAY = "2026-11-20";
const SEVEN: HistoryPeriodRange = {
  period: "7",
  from: "2026-11-14",
  to: "2026-11-20",
};
const THIRTY: HistoryPeriodRange = {
  period: "30",
  from: "2026-10-22",
  to: "2026-11-20",
};
const RANGE: HistoryPeriodRange = {
  period: "range",
  from: "2026-11-01",
  to: "2026-11-05",
};

function setup(
  period: HistoryPeriodRange = SEVEN,
  sectorParam: string | null = null,
) {
  return render(
    <DashboardPeriodPicker
      period={period}
      today={TODAY}
      sectorParam={sectorParam}
    />,
  );
}

async function openForm() {
  await userEvent.click(screen.getByRole("button", { name: "Intervalo" }));
}

function fill(from: string, to: string) {
  fireEvent.change(screen.getByLabelText("De"), { target: { value: from } });
  fireEvent.change(screen.getByLabelText("Até"), { target: { value: to } });
}

describe("DashboardPeriodPicker", () => {
  beforeEach(() => {
    mocks.push.mockReset();
  });

  it("os atalhos são links e o do período ativo tem aria-current", () => {
    setup(SEVEN);

    const nav = screen.getByRole("navigation", { name: "Período" });
    expect(nav).toBeInTheDocument();
    const seven = screen.getByRole("link", { name: "Últimos 7 dias" });
    const thirty = screen.getByRole("link", { name: "Últimos 30 dias" });
    expect(seven).toHaveAttribute("href", "/dashboard");
    expect(seven).toHaveAttribute("aria-current", "page");
    expect(thirty).toHaveAttribute("href", "/dashboard?periodo=30");
    expect(thirty).not.toHaveAttribute("aria-current");
  });

  it("30 dias ativo; um intervalo não marca nenhum atalho", () => {
    const { unmount } = setup(THIRTY);
    expect(
      screen.getByRole("link", { name: "Últimos 30 dias" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Últimos 7 dias" }),
    ).not.toHaveAttribute("aria-current");
    unmount();

    setup(RANGE);
    expect(
      screen.getByRole("link", { name: "Últimos 7 dias" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.getByRole("link", { name: "Últimos 30 dias" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("os atalhos levam o setor do admin (id e todos)", () => {
    const { unmount } = setup(SEVEN, "todos");
    expect(
      screen.getByRole("link", { name: "Últimos 7 dias" }),
    ).toHaveAttribute("href", "/dashboard?setor=todos");
    expect(
      screen.getByRole("link", { name: "Últimos 30 dias" }),
    ).toHaveAttribute("href", "/dashboard?periodo=30&setor=todos");
    unmount();

    setup(SEVEN, "11111111-1111-4111-8111-111111111111");
    expect(
      screen.getByRole("link", { name: "Últimos 30 dias" }),
    ).toHaveAttribute(
      "href",
      "/dashboard?periodo=30&setor=11111111-1111-4111-8111-111111111111",
    );
  });

  it("Intervalo é um disclosure: aria-expanded e aria-controls, sem aria-pressed", async () => {
    setup(SEVEN);

    const button = screen.getByRole("button", { name: "Intervalo" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).not.toHaveAttribute("aria-pressed");
    const controls = button.getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(
      screen.queryByRole("form", { name: "Intervalo do período" }),
    ).not.toBeInTheDocument();

    await openForm();

    expect(button).toHaveAttribute("aria-expanded", "true");
    const form = screen.getByRole("form", { name: "Intervalo do período" });
    expect(form.id).toBe(controls);

    await openForm();

    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("abre com as datas do período (nunca em branco), com max em hoje", async () => {
    setup(SEVEN);
    await openForm();

    const from = screen.getByLabelText("De");
    const to = screen.getByLabelText("Até");
    expect(from).toHaveValue("2026-11-14");
    expect(to).toHaveValue("2026-11-20");
    expect(from).toHaveAttribute("max", TODAY);
    expect(to).toHaveAttribute("max", TODAY);
    expect(from).toHaveClass("text-base");
  });

  it("com um intervalo ativo, o formulário já vem aberto e marcado como atual", () => {
    setup(RANGE);

    expect(screen.getByRole("button", { name: "Intervalo" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const form = screen.getByRole("form", { name: "Intervalo do período" });
    expect(form).toHaveAttribute("aria-current", "true");
    expect(screen.getByLabelText("De")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-11-05");
  });

  it("Aplicar intervalo navega com periodo=intervalo, de e ate", async () => {
    setup(SEVEN);
    await openForm();
    fill("2026-11-01", "2026-11-05");

    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar intervalo" }),
    );

    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith(
      "/dashboard?periodo=intervalo&de=2026-11-01&ate=2026-11-05",
    );
  });

  it("leva o setor escolhido pelo admin junto", async () => {
    setup(SEVEN, "todos");
    await openForm();
    fill("2026-11-01", "2026-11-05");

    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar intervalo" }),
    );

    expect(mocks.push).toHaveBeenCalledWith(
      "/dashboard?periodo=intervalo&de=2026-11-01&ate=2026-11-05&setor=todos",
    );
  });

  it("um dia só e exatamente 93 dias são aceitos", async () => {
    setup(SEVEN);
    await openForm();

    fill("2026-11-20", "2026-11-20");
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar intervalo" }),
    );
    expect(mocks.push).toHaveBeenLastCalledWith(
      "/dashboard?periodo=intervalo&de=2026-11-20&ate=2026-11-20",
    );

    // 2026-08-20 .. 2026-11-20 = 93 dias.
    fill("2026-08-20", "2026-11-20");
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar intervalo" }),
    );
    expect(mocks.push).toHaveBeenLastCalledWith(
      "/dashboard?periodo=intervalo&de=2026-08-20&ate=2026-11-20",
    );
  });

  it.each([
    {
      caso: "data inicial vazia",
      from: "",
      to: "2026-11-05",
      message: "Informe as duas datas.",
      campo: "De",
    },
    {
      caso: "data final vazia",
      from: "2026-11-01",
      to: "",
      message: "Informe as duas datas.",
      campo: "Até",
    },
    {
      caso: "inicial depois da final",
      from: "2026-11-10",
      to: "2026-11-05",
      message: "A data inicial precisa ser igual ou anterior à final.",
      campo: "De",
    },
    {
      caso: "final no futuro",
      from: "2026-11-15",
      to: "2026-11-21",
      message: "Escolha datas até hoje.",
      campo: "Até",
    },
    {
      caso: "94 dias",
      from: "2026-08-19",
      to: "2026-11-20",
      message: "O intervalo pode ter no máximo 93 dias.",
      campo: "De",
    },
  ])("$caso: mostra o erro no campo e não navega", async ({
    from,
    to,
    message,
    campo,
  }) => {
    setup(SEVEN);
    await openForm();
    fill(from, to);

    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar intervalo" }),
    );

    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByLabelText(campo)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("editar um campo limpa o erro", async () => {
    setup(SEVEN);
    await openForm();
    fill("", "2026-11-05");
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar intervalo" }),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("De"), {
      target: { value: "2026-11-01" },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
