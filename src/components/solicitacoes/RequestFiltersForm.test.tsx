import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  defaultRequestFilters,
  parseRequestFilters,
  type RequestFilters,
} from "@/features/requests/requestFilters";
import { RequestFiltersForm } from "./RequestFiltersForm";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

const DOCA = "11111111-1111-4111-8111-111111111111";
const ANTIGO = "22222222-2222-4222-8222-222222222222";
const DESTINATIONS = [
  { id: DOCA, name: "Doca 3", active: true },
  { id: ANTIGO, name: "Galpão Velho", active: false },
];
const CREATORS = [
  { id: "ana", name: "Ana Teste" },
  { id: "bia", name: "Bia Teste" },
];

function setup(
  filters: RequestFilters = defaultRequestFilters(),
  sectorParam: string | null = null,
) {
  render(
    <RequestFiltersForm
      filters={filters}
      destinations={DESTINATIONS}
      creators={CREATORS}
      sectorParam={sectorParam}
    />,
  );
}

describe("RequestFiltersForm", () => {
  beforeEach(() => {
    mocks.push.mockReset();
  });

  it("é um formulário nomeado e nunca começa em branco nas escolhas", () => {
    setup();

    expect(
      screen.getByRole("form", { name: "Filtros das solicitações" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Destino")).toHaveValue("all");
    expect(screen.getByLabelText("Período")).toHaveValue("all");
    expect(screen.getByLabelText("Quem criou")).toHaveValue("all");
    expect(screen.getByLabelText("Busca")).toHaveValue("");
  });

  it("as opções são escolhas: destinos (inativo marcado) e Outro, pessoas, períodos", () => {
    setup();

    const options = (label: string) =>
      within(screen.getByLabelText(label))
        .getAllByRole("option")
        .map((option) => option.textContent);
    expect(options("Destino")).toEqual([
      "Todos os destinos",
      "Doca 3",
      "Galpão Velho (inativo)",
      "Outro",
    ]);
    expect(options("Quem criou")).toEqual([
      "Todas as pessoas",
      "Ana Teste",
      "Bia Teste",
    ]);
    expect(options("Período")).toEqual([
      "Todo o período",
      "Últimos 7 dias",
      "Últimos 30 dias",
      "Intervalo",
    ]);
  });

  it("começa com os valores da URL", () => {
    setup(
      parseRequestFilters(
        { destino: DOCA, periodo: "30", criador: "bia", busca: "rolos" },
        "2026-11-23",
      ),
    );

    expect(screen.getByLabelText("Destino")).toHaveValue(DOCA);
    expect(screen.getByLabelText("Período")).toHaveValue("30");
    expect(screen.getByLabelText("Quem criou")).toHaveValue("bia");
    expect(screen.getByLabelText("Busca")).toHaveValue("rolos");
  });

  it("De e Até só aparecem em Intervalo, já preenchidos", async () => {
    setup({
      ...defaultRequestFilters(),
      from: "2026-11-17",
      to: "2026-11-23",
    });
    expect(screen.queryByLabelText("De")).toBeNull();

    await userEvent.selectOptions(screen.getByLabelText("Período"), "range");

    expect(screen.getByLabelText("De")).toHaveValue("2026-11-17");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-11-23");
  });

  it("Aplicar filtros monta a URL, zera a paginação e mantém a visão e o setor", async () => {
    const filters = parseRequestFilters(
      { visao: "tabela", pagina: "3", mais_solicitada: "60" },
      "2026-11-23",
    );
    setup(filters, "todos");

    await userEvent.selectOptions(screen.getByLabelText("Destino"), DOCA);
    await userEvent.selectOptions(screen.getByLabelText("Período"), "7");
    await userEvent.selectOptions(screen.getByLabelText("Quem criou"), "ana");
    await userEvent.type(screen.getByLabelText("Busca"), "  Fita   azul ");
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    );

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      `/solicitacoes?visao=tabela&destino=${DOCA}&periodo=7&criador=ana&busca=Fita+azul&setor=todos`,
    );
  });

  it("Intervalo vai para a URL com de e ate", async () => {
    setup(
      { ...defaultRequestFilters(), from: "2026-11-01", to: "2026-11-10" },
      null,
    );

    await userEvent.selectOptions(screen.getByLabelText("Período"), "range");
    fireEvent.change(screen.getByLabelText("De"), {
      target: { value: "2026-11-02" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    );

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      "/solicitacoes?periodo=intervalo&de=2026-11-02&ate=2026-11-10",
    );
  });

  it("filtros todos em 'todos' e sem busca voltam a /solicitacoes", async () => {
    setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    );

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/solicitacoes");
  });

  it("Outro vai para a URL como destino=outro", async () => {
    setup();

    await userEvent.selectOptions(screen.getByLabelText("Destino"), "outro");
    await userEvent.click(
      screen.getByRole("button", { name: "Aplicar filtros" }),
    );

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(
      "/solicitacoes?destino=outro",
    );
  });

  it("a busca respeita o limite de 80 e usa fonte de 16px", () => {
    setup();

    const search = screen.getByLabelText("Busca");
    expect(search).toHaveAttribute("type", "search");
    expect(search).toHaveAttribute("maxlength", "80");
    expect(search).toHaveAttribute("placeholder", "Descrição ou destino");
    expect(search.className).toContain("text-base");
  });

  it("Limpar filtros é um link que preserva a visão e o setor", () => {
    setup(
      parseRequestFilters({ visao: "lista", busca: "x" }, "2026-11-23"),
      "abc",
    );

    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/solicitacoes?visao=lista&setor=abc");
  });

  it("Limpar filtros sem visão nem setor é /solicitacoes", () => {
    setup();

    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/solicitacoes");
  });
});
