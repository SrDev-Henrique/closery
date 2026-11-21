import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { heightUnit, TOUCH_UNIT } from "../../../test/touchTargets";
import { QuantityCounter } from "./QuantityCounter";

const LABEL = "Rede de proteção";

// O contador é controlado: o pai guarda o valor, como no formulário.
function setup(props: { initial?: number; disabled?: boolean } = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  function Harness() {
    const [value, setValue] = useState(props.initial ?? 0);
    return (
      <TooltipProvider>
        <QuantityCounter
          label={LABEL}
          unit="rolo"
          value={value}
          disabled={props.disabled}
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

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

describe("QuantityCounter", () => {
  it("começa em 0 (nunca em branco), com a unidade ao lado e o grupo nomeado", () => {
    setup();

    expect(input()).toHaveValue("0");
    expect(screen.getByText("rolo")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: LABEL })).toBeInTheDocument();
  });

  it("+ e − mudam o valor e salvam já (onChange e onCommit)", async () => {
    const { onChange, onCommit } = setup({ initial: 3 });

    await userEvent.click(plus());
    expect(input()).toHaveValue("4");
    await userEvent.click(minus());
    await userEvent.click(minus());

    expect(input()).toHaveValue("2");
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([4, 3, 2]);
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual([4, 3, 2]);
  });

  it("− trava em 0", async () => {
    const { onChange } = setup({ initial: 0 });

    expect(minus()).toBeDisabled();
    await userEvent.click(minus());
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue("0");
  });

  it("+ trava em 99.999", async () => {
    const { onChange } = setup({ initial: 99_999 });

    expect(plus()).toBeDisabled();
    await userEvent.click(plus());
    expect(onChange).not.toHaveBeenCalled();
    expect(minus()).toBeEnabled();
  });

  it("digitar substitui o valor (o campo seleciona tudo ao receber foco)", async () => {
    const { onChange } = setup({ initial: 8 });

    await userEvent.click(input());
    await userEvent.keyboard("12");

    expect(input()).toHaveValue("12");
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("letras e símbolos são ignorados e nunca viram NaN", async () => {
    const { onChange } = setup({ initial: 5 });

    await userEvent.click(input());
    await userEvent.keyboard("abc-.,");

    expect(onChange).not.toHaveBeenCalled();
    expect(input()).not.toHaveValue("NaN");
  });

  it("zeros à esquerda somem: 007 vira 7", async () => {
    const { onChange } = setup({ initial: 1 });

    await userEvent.click(input());
    await userEvent.keyboard("007");

    expect(input()).toHaveValue("7");
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("aceita no máximo 5 dígitos", async () => {
    setup({ initial: 1 });

    await userEvent.click(input());
    await userEvent.keyboard("1234567");

    expect(input()).toHaveValue("12345");
  });

  it("campo vazio ao sair vira 0 e esse 0 é salvo", async () => {
    const { onChange, onCommit } = setup({ initial: 6 });

    await userEvent.clear(input());
    expect(input()).toHaveValue("");
    // Esvaziar enquanto digita não salva nada.
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.tab();

    expect(input()).toHaveValue("0");
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("sair do campo depois de digitar salva o valor digitado", async () => {
    const { onCommit } = setup({ initial: 0 });

    await userEvent.click(input());
    await userEvent.keyboard("5");
    await userEvent.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(5);
  });

  it("passar pelo campo sem digitar não salva nada", async () => {
    const { onChange, onCommit } = setup({ initial: 4 });

    await userEvent.click(input());
    await userEvent.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("desabilitado trava os três controles", () => {
    setup({ initial: 3, disabled: true });

    expect(minus()).toBeDisabled();
    expect(plus()).toBeDisabled();
    expect(input()).toBeDisabled();
  });

  it("botões e campo têm alvo de 44px no celular e texto de 16px", () => {
    setup();

    for (const button of [minus(), plus()]) {
      expect(heightUnit(button.className, "max-md:")).toBe(TOUCH_UNIT);
    }
    expect(heightUnit(input().className, "max-md:")).toBe(TOUCH_UNIT);
    expect(input()).toHaveClass("text-base", "tabular-nums", "text-center");
    expect(input()).toHaveAttribute("inputmode", "numeric");
  });

  it("mostra os tooltips 'Diminuir' e 'Aumentar'", async () => {
    setup({ initial: 2 });
    expect(screen.queryByText("Aumentar")).not.toBeInTheDocument();

    hover(plus());
    await waitFor(() =>
      expect(screen.getByText("Aumentar")).toBeInTheDocument(),
    );
    hover(minus());
    await waitFor(() =>
      expect(screen.getByText("Diminuir")).toBeInTheDocument(),
    );
  });
});
