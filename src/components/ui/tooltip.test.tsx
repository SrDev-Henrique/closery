import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  MotionTree,
  scaleOf,
  stubReducedMotion,
  styleOnInsert,
  translateOf,
} from "../../../test/motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// A entrada do tooltip pelo Motion (emenda do Motion): sai do gatilho (4px) crescendo de 0,96; no
// reduzido, só um fade. O primeiro quadro é lido no instante em que o popup entra no DOM.

const POPUP = '[data-slot="tooltip-content"]';

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

function renderTooltip(side: "top" | "bottom" | "left" | "right") {
  render(
    <MotionTree>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<button type="button" />}>
            Gatilho
          </TooltipTrigger>
          <TooltipContent side={side}>Dica</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </MotionTree>,
  );
  return screen.getByRole("button", { name: "Gatilho" });
}

function popup(): HTMLElement {
  const element = document.querySelector<HTMLElement>(POPUP);
  if (!element) throw new Error("tooltip ausente");
  return element;
}

describe("TooltipContent — entrada (Motion)", () => {
  let restoreMedia: () => void = () => {};

  afterEach(() => {
    restoreMedia();
    restoreMedia = () => {};
  });

  it.each([
    ["top", "Y", 4],
    ["bottom", "Y", -4],
    ["left", "X", 4],
    ["right", "X", -4],
  ] as const)("à %s: entra saindo do gatilho e crescendo, até parar no lugar", async (side, axis, from) => {
    restoreMedia = stubReducedMotion(false);
    const trigger = renderTooltip(side);
    const first = styleOnInsert(POPUP, ["transform", "opacity"]);
    hover(trigger);

    const start = await first;
    expect(translateOf(start.transform ?? "", axis)).toEqual({
      value: from,
      unit: "px",
    });
    expect(scaleOf(start.transform ?? "")).toBe(0.96);
    expect(start.opacity).toBe("0");
    await waitFor(() => {
      expect(popup().style.transform).toBe("none");
      expect(popup().style.opacity).toBe("1");
    });
    expect(popup()).toHaveTextContent("Dica");
  });

  it("com movimento reduzido: só o fade, sem deslocamento nem escala", async () => {
    restoreMedia = stubReducedMotion(true);
    const trigger = renderTooltip("top");
    const first = styleOnInsert(POPUP, ["transform", "opacity"]);
    hover(trigger);

    expect(await first).toEqual({ transform: "", opacity: "0" });
    await waitFor(() => expect(popup().style.opacity).toBe("1"));
    expect(popup().style.transform).toBe("");
  });

  it("não usa as animações de CSS do tw-animate-css (correriam junto com o Motion)", async () => {
    restoreMedia = stubReducedMotion(false);
    hover(renderTooltip("top"));
    await screen.findByText("Dica");
    expect(popup().className).not.toMatch(/animate-|fade-|zoom-|slide-in/);
  });
});
