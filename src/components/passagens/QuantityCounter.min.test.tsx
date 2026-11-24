import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { QuantityCounter } from "./QuantityCounter";

const LABEL = "Luva";

// Contador com mínimo 1, como o das linhas de item da solicitação.
function setup(props: { initial?: number; min?: number } = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  function Harness() {
    const [value, setValue] = useState(props.initial ?? 1);
    return (
      <TooltipProvider>
        <QuantityCounter
          label={LABEL}
          unit="par"
          value={value}
          min={props.min}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
          onCommit={onCommit}
        />
      </TooltipProvider>
    );
  }
  render(<Harness />);
  return { onChange, onCommit };
}

const input = () =>
  screen.getByRole("textbox", { name: `Quantidade de ${LABEL}` });
const minus = () => screen.getByRole("button", { name: `Diminuir ${LABEL}` });
const plus = () => screen.getByRole("button", { name: `Aumentar ${LABEL}` });

describe("QuantityCounter com min={1}", () => {
  it("− fica desativado no mínimo e + continua funcionando", async () => {
    const { onChange } = setup({ initial: 1, min: 1 });

    expect(minus()).toBeDisabled();
    await userEvent.click(minus());
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(plus());
    expect(input()).toHaveValue("2");
    expect(minus()).toBeEnabled();
  });

  it("− para no mínimo, nunca abaixo", async () => {
    setup({ initial: 2, min: 1 });

    await userEvent.click(minus());
    expect(input()).toHaveValue("1");
    expect(minus()).toBeDisabled();
  });

  it("campo vazio ao sair volta ao mínimo e esse valor é salvo", async () => {
    const { onChange, onCommit } = setup({ initial: 4, min: 1 });

    await userEvent.clear(input());
    expect(input()).toHaveValue("");
    expect(onCommit).not.toHaveBeenCalled();
    await userEvent.tab();

    expect(input()).toHaveValue("1");
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it("digitar 0 fica só no campo (não chama onChange) e ao sair vira o mínimo", async () => {
    const { onChange, onCommit } = setup({ initial: 4, min: 1 });

    await userEvent.click(input());
    await userEvent.keyboard("0");
    expect(input()).toHaveValue("0");
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.tab();

    expect(input()).toHaveValue("1");
    expect(onChange).toHaveBeenLastCalledWith(1);
    expect(onCommit).toHaveBeenCalledWith(1);
  });

  it("digitar um valor válido acima do mínimo chama onChange na hora", async () => {
    const { onChange } = setup({ initial: 1, min: 1 });

    await userEvent.click(input());
    await userEvent.keyboard("12");

    expect(input()).toHaveValue("12");
    expect(onChange).toHaveBeenLastCalledWith(12);
  });
});

describe("QuantityCounter sem min", () => {
  it("o padrão continua 0: − desativado só em 0 e campo vazio vira 0", async () => {
    setup({ initial: 1 });

    expect(minus()).toBeEnabled();
    await userEvent.click(minus());
    expect(input()).toHaveValue("0");
    expect(minus()).toBeDisabled();

    await userEvent.clear(input());
    await userEvent.tab();
    expect(input()).toHaveValue("0");
  });
});
