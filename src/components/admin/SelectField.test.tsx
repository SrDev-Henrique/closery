import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectField } from "./SelectField";

const options = [
  { value: "unidade", label: "Unidade" },
  { value: "rolo", label: "Rolo" },
  { value: "outro", label: "Outro…" },
];

describe("SelectField", () => {
  it("o rótulo nomeia o seletor e mostra a opção atual", () => {
    render(
      <SelectField
        label="Unidade"
        value="rolo"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Unidade" });
    expect(select).toHaveValue("rolo");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("escolher outra opção avisa com o valor", async () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        label="Unidade"
        value="unidade"
        options={options}
        onValueChange={onValueChange}
      />,
    );

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Unidade" }),
      "outro",
    );

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("outro");
  });

  it("respeita o id recebido para ligar o rótulo", () => {
    render(
      <SelectField
        id="unidade-do-item"
        label="Unidade"
        value="unidade"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Unidade" })).toHaveAttribute(
      "id",
      "unidade-do-item",
    );
  });

  it("mostra a descrição ligada ao seletor", () => {
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        description="Só para operador."
        onValueChange={vi.fn()}
      />,
    );

    const description = screen.getByText("Só para operador.");
    expect(screen.getByRole("combobox", { name: "Setor" })).toHaveAttribute(
      "aria-describedby",
      description.id,
    );
  });

  it("com erro marca o seletor inválido e anuncia a mensagem", () => {
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        error="Escolha o setor do operador."
        onValueChange={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Setor" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Escolha o setor do operador.");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(alert.id),
    );
  });

  it("sem erro não marca inválido", () => {
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Setor" })).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("desabilitado não aceita escolha", async () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        disabled
        onValueChange={onValueChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Setor" });
    expect(select).toBeDisabled();
    await userEvent.selectOptions(select, "rolo");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
