import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRESS_SCALE } from "@/lib/motion";
import {
  MotionTree,
  scaleOf,
  stubReducedMotion,
  wait,
} from "../../../test/motion";
import { Button } from "./button";

describe("Button", () => {
  it("renderiza o rótulo como botão acessível", () => {
    render(<Button>Entregar turno</Button>);
    expect(
      screen.getByRole("button", { name: "Entregar turno" }),
    ).toBeInTheDocument();
  });

  it("dispara onClick ao clicar", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("desabilitado não dispara onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

// O aperto (emenda do Motion): o elemento do Button é o PressButton, que encolhe para PRESS_SCALE na
// mola `press`. O jsdom não tem Web Animations: o Motion anima em JS e escreve o `transform` no style.
describe("Button — aperto (Motion)", () => {
  let restoreMedia: () => void = () => {};

  afterEach(() => {
    restoreMedia();
    restoreMedia = () => {};
  });

  function press(element: HTMLElement) {
    fireEvent.pointerDown(element, { pointerType: "mouse", button: 0 });
  }

  function release(element: HTMLElement) {
    fireEvent.pointerUp(element, { pointerType: "mouse", button: 0 });
  }

  it("no servidor é um <button> com data-press e sem estilo inline (nada anima na hidratação)", () => {
    const html = renderToString(
      <MotionTree>
        <Button>Entregar turno</Button>
      </MotionTree>,
    );
    expect(html).toMatch(/^<button[^>]*data-press="motion"/);
    expect(html).not.toContain("style=");
  });

  it("todo Button marca data-press (o aperto de CSS do buttonVariants fica só para o <Link> cru)", () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole("button", { name: "Salvar" })).toHaveAttribute(
      "data-press",
      "motion",
    );
  });

  it("apertado encolhe para PRESS_SCALE e volta ao soltar", async () => {
    restoreMedia = stubReducedMotion(false);
    render(
      <MotionTree>
        <Button>Entregar turno</Button>
      </MotionTree>,
    );
    const button = screen.getByRole("button", { name: "Entregar turno" });

    press(button);
    await waitFor(() =>
      expect(scaleOf(button.style.transform)).toBe(PRESS_SCALE),
    );
    release(button);
    await waitFor(() => expect(button.style.transform).toBe("none"));
  });

  it("com movimento reduzido não encolhe, e o clique continua valendo", async () => {
    restoreMedia = stubReducedMotion(true);
    const onClick = vi.fn();
    render(
      <MotionTree>
        <Button onClick={onClick}>Salvar</Button>
      </MotionTree>,
    );
    const button = screen.getByRole("button", { name: "Salvar" });

    press(button);
    await wait(250);
    expect(button.style.transform).toBe("");
    release(button);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("gatilho de popup (aria-haspopup) não encolhe: responde só com a cor", async () => {
    restoreMedia = stubReducedMotion(false);
    render(
      <MotionTree>
        <Button aria-haspopup="menu">Mais ações</Button>
      </MotionTree>,
    );
    const button = screen.getByRole("button", { name: "Mais ações" });

    press(button);
    await wait(250);
    expect(button.style.transform).toBe("");
    release(button);
  });
});
