import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SheetMotionKind, SheetSide } from "@/lib/motion";
import {
  MotionTree,
  stubReducedMotion,
  styleOnInsert,
  translateOf,
} from "../../../test/motion";
import { Sheet, SheetContent, SheetTitle } from "./sheet";

// Véu e painel pelo Motion (emenda do Motion). O primeiro quadro é lido no instante em que o elemento
// entra no DOM; depois, o fim no lugar. A saída (que o Base UI espera pela opacidade) só se prova no
// Chromium: e2e/motion.spec.ts (o jsdom não tem getAnimations e desmonta na hora).

const POPUP = '[data-slot="sheet-content"]';
const OVERLAY = '[data-slot="sheet-overlay"]';

function renderSheet(side: SheetSide, motionKind: SheetMotionKind = "sheet") {
  return render(
    <MotionTree>
      <Sheet open>
        <SheetContent side={side} motionKind={motionKind}>
          <SheetTitle>Detalhe</SheetTitle>
        </SheetContent>
      </Sheet>
    </MotionTree>,
  );
}

function element(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (!found) throw new Error(`${selector} ausente`);
  return found;
}

describe("Sheet — entrada (Motion)", () => {
  let restoreMedia: () => void = () => {};

  afterEach(() => {
    restoreMedia();
    restoreMedia = () => {};
  });

  it.each([
    ["right", "X", 40],
    ["left", "X", -40],
    ["top", "Y", -40],
    ["bottom", "Y", 40],
  ] as const)("à %s: o painel chega de 40px com fade e para no lugar", async (side, axis, from) => {
    restoreMedia = stubReducedMotion(false);
    const first = styleOnInsert(POPUP, ["transform", "opacity"]);
    renderSheet(side);

    const start = await first;
    expect(translateOf(start.transform ?? "", axis)).toEqual({
      value: from,
      unit: "px",
    });
    expect(start.opacity).toBe("0");
    await waitFor(() => {
      expect(element(POPUP).style.transform).toBe("none");
      expect(element(POPUP).style.opacity).toBe("1");
    });
  });

  it("a gaveta vem da borda (−105%), opaca, e para no lugar", async () => {
    restoreMedia = stubReducedMotion(false);
    const first = styleOnInsert(POPUP, ["transform", "opacity"]);
    renderSheet("left", "drawer");

    const start = await first;
    expect(translateOf(start.transform ?? "", "X")).toEqual({
      value: -105,
      unit: "%",
    });
    expect(start.opacity).toBe("1");
    await waitFor(() => expect(element(POPUP).style.transform).toBe("none"));
  });

  it("o véu entra em fade", async () => {
    restoreMedia = stubReducedMotion(false);
    const first = styleOnInsert(OVERLAY, ["opacity"]);
    renderSheet("right");

    expect((await first).opacity).toBe("0");
    await waitFor(() => expect(element(OVERLAY).style.opacity).toBe("1"));
  });

  it.each([
    "sheet",
    "drawer",
  ] as const)("com movimento reduzido (%s): só o fade, sem deslocamento", async (kind) => {
    restoreMedia = stubReducedMotion(true);
    const first = styleOnInsert(POPUP, ["transform", "opacity"]);
    renderSheet("left", kind);

    expect(await first).toEqual({ transform: "", opacity: "0" });
    await waitFor(() => expect(element(POPUP).style.opacity).toBe("1"));
    expect(element(POPUP).style.transform).toBe("");
  });
});
