import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { FieldValues, ItemLine } from "@/features/handovers/types";
import { HandoverFields } from "./HandoverFields";

const REDE: ItemLine = {
  itemId: "a1",
  name: "Rede de proteção",
  unit: "rolo",
  kind: "control",
  quantity: 0,
  note: "",
};
const FITA: ItemLine = {
  itemId: "b1",
  name: "Fita adesiva",
  unit: "rolo",
  kind: "stock",
  quantity: 0,
  note: "",
};

const EMPTY_VALUES: FieldValues = {
  occurrencesText: "",
  nextShiftText: "",
  quantities: { a1: 0, b1: 0 },
  notes: { a1: "", b1: "" },
};

function setup(props: Partial<Parameters<typeof HandoverFields>[0]> = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <TooltipProvider>
      <HandoverFields
        controls={[REDE]}
        stock={[FITA]}
        values={EMPTY_VALUES}
        onChange={onChange}
        onCommit={onCommit}
        canManageCatalog={false}
        itemsHref="/admin/itens?setor=s1"
        {...props}
      />
    </TooltipProvider>,
  );
  return { onChange, onCommit };
}

describe("HandoverFields", () => {
  it("mostra as quatro seções, na ordem do briefing, com as ajudas", () => {
    setup();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Controles", "Estoque"]);
    expect(
      screen.getByText("Soma no período, como redes danificadas."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Contagem de agora. Vale a última, nunca a soma."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ocorrências do turno")).toBeInTheDocument();
    expect(
      screen.getByText("Opcional. Conte o que saiu do normal."),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Fica para o próximo turno"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Opcional. O que quem recebe precisa saber primeiro."),
    ).toBeInTheDocument();
  });

  it("controles ficam antes do estoque, e as ocorrências depois dos dois", () => {
    setup();

    const text = document.body.textContent ?? "";
    expect(text.indexOf("Controles")).toBeLessThan(text.indexOf("Estoque"));
    expect(text.indexOf("Estoque")).toBeLessThan(
      text.indexOf("Ocorrências do turno"),
    );
    expect(text.indexOf("Ocorrências do turno")).toBeLessThan(
      text.lastIndexOf("Fica para o próximo turno"),
    );
  });

  it("os números chegam como estão em `values`, nunca em branco", () => {
    setup({
      values: { ...EMPTY_VALUES, quantities: { a1: 12, b1: 0 } },
    });

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("12");
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
    ).toHaveValue("0");
  });

  it("item sem entrada em values cai em 0 (nunca vazio)", () => {
    setup({ values: { ...EMPTY_VALUES, quantities: {}, notes: {} } });

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("0");
  });

  it("digitar nas ocorrências chama onChange; sair do campo chama onCommit", async () => {
    const { onChange, onCommit } = setup();

    await userEvent.type(screen.getByLabelText("Ocorrências do turno"), "A");
    expect(onChange).toHaveBeenLastCalledWith({
      field: "occurrences",
      value: "A",
    });

    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith({ field: "occurrences", value: "" });
  });

  it("'Fica para o próximo turno' manda o campo nextShift", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Fica para o próximo turno"),
      "B",
    );

    expect(onChange).toHaveBeenLastCalledWith({
      field: "nextShift",
      value: "B",
    });
  });

  it("+ do item manda quantity com o itemId; observação manda note", async () => {
    const { onChange, onCommit } = setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      field: "quantity",
      itemId: "a1",
      value: 1,
    });
    expect(onCommit).toHaveBeenCalledWith({
      field: "quantity",
      itemId: "a1",
      value: 1,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Adicionar observação em Fita adesiva",
      }),
    );
    await userEvent.type(
      screen.getByLabelText("Observação de Fita adesiva"),
      "x",
    );
    expect(onChange).toHaveBeenLastCalledWith({
      field: "note",
      itemId: "b1",
      value: "x",
    });
  });

  it("o campo de texto limita 2.000 caracteres e usa fonte de 16px", () => {
    setup();

    const field = screen.getByLabelText("Ocorrências do turno");
    expect(field).toHaveAttribute("maxlength", "2000");
    expect(field).toHaveClass("text-base");
  });

  it("o contador de caracteres só aparece perto do limite", () => {
    setup({
      values: { ...EMPTY_VALUES, occurrencesText: "a".repeat(1799) },
    });
    expect(screen.queryByText(/de 2\.000 caracteres/)).not.toBeInTheDocument();
  });

  it("a partir de 90% mostra quantos caracteres já tem", () => {
    setup({
      values: { ...EMPTY_VALUES, occurrencesText: "a".repeat(1800) },
    });

    expect(screen.getByText("1.800 de 2.000 caracteres")).toBeInTheDocument();
  });

  it("desabilitado trava os campos e os contadores", () => {
    setup({ disabled: true });

    expect(screen.getByLabelText("Ocorrências do turno")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    ).toBeDisabled();
  });

  it("sem controles, só Estoque aparece", () => {
    setup({ controls: [] });

    expect(
      screen.queryByRole("heading", { name: "Controles" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Estoque" }),
    ).toBeInTheDocument();
  });

  describe("setor sem itens", () => {
    it("operador: pede ao administrador e ainda deixa entregar com ocorrências", () => {
      setup({ controls: [], stock: [] });

      expect(screen.getByText("Nenhum item neste setor.")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Peça a um administrador para cadastrar os itens. Você ainda pode entregar o turno com as ocorrências.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Ir para Itens" }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Ocorrências do turno")).toBeInTheDocument();
    });

    it("admin: texto próprio e link para os itens do setor", () => {
      setup({ controls: [], stock: [], canManageCatalog: true });

      expect(
        screen.getByText(
          "Cadastre os itens do setor para contá-los na passagem.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Ir para Itens" }),
      ).toHaveAttribute("href", "/admin/itens?setor=s1");
    });

    it("sem itens não há seção Controles nem Estoque", () => {
      setup({ controls: [], stock: [] });

      expect(
        screen.queryByRole("heading", { name: "Controles" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Estoque" }),
      ).not.toBeInTheDocument();
    });
  });
});
