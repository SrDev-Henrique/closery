import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceGroup } from "./ChoiceGroup";

type Role = "operator" | "admin";

const options = [
  { value: "operator", label: "Operador" },
  { value: "admin", label: "Administrador" },
] as const;

function Harness({
  onChange,
  disabled,
  description,
}: {
  onChange: (value: Role) => void;
  disabled?: boolean;
  description?: string;
}) {
  const [value, setValue] = useState<Role>("operator");
  return (
    <ChoiceGroup<Role>
      legend="Papel"
      value={value}
      options={options}
      description={description}
      disabled={disabled}
      onValueChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe("ChoiceGroup", () => {
  it("é um grupo nomeado pela legenda, com a opção escolhida marcada", () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Papel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar em outra opção troca a seleção e avisa", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Administrador" }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith("admin");
    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicar na opção já escolhida não desmarca nem avisa", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Operador" }));
    await userEvent.click(screen.getByRole("button", { name: "Operador" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("escolhe pelo teclado (Tab até a opção e Espaço)", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("admin");
  });

  it("mostra a descrição ligada ao grupo", () => {
    render(
      <Harness onChange={vi.fn()} description="Quem pode mudar cadastros." />,
    );

    const description = screen.getByText("Quem pode mudar cadastros.");
    expect(screen.getByRole("group", { name: "Papel" })).toHaveAttribute(
      "aria-describedby",
      description.id,
    );
  });

  it("desabilitado não aceita clique", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} disabled />);

    await userEvent.click(
      screen.getByRole("button", { name: "Administrador" }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
