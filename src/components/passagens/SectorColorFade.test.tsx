import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";
import { MotionTree, stubReducedMotion, wait } from "../../../test/motion";
import {
  REMOUNT_WINDOW_MS,
  resetSectorColorMemory,
  SectorColorFade,
} from "./SectorColorFade";

// A troca de cor do cartão do turno (emenda do Motion): a cor de antes, por cima da nova, some. A
// troca de setor remonta o cartão (P86, P87): a remontagem logo depois de um cartão sair também vale.

const LAYER = '[data-slot="sector-color-fade"]';
const layer = () => document.querySelector<HTMLElement>(LAYER);

// `id` muda a key: o cartão remonta, como na troca de setor.
function Card({ color, id = "a" }: { color: SectorColor; id?: string }) {
  return (
    <MotionTree>
      <div key={id} data-testid="cartao">
        <SectorColorFade color={color} />
      </div>
    </MotionTree>
  );
}

describe("SectorColorFade", () => {
  let restoreMedia: () => void = () => {};

  beforeEach(() => {
    resetSectorColorMemory();
  });

  afterEach(() => {
    restoreMedia();
    restoreMedia = () => {};
    vi.restoreAllMocks();
  });

  it("não existe no HTML do servidor nem no primeiro render (nada anima na carga)", () => {
    expect(renderToString(<Card color="lilac" />)).toBe(
      '<div data-testid="cartao"></div>',
    );
    restoreMedia = stubReducedMotion(false);
    render(<Card color="lilac" />);
    expect(layer()).toBeNull();
  });

  it("a mesma cor de novo não cria camada", async () => {
    restoreMedia = stubReducedMotion(false);
    const { rerender } = render(<Card color="lilac" />);
    rerender(<Card color="lilac" />);
    await wait(50);
    expect(layer()).toBeNull();
  });

  it("trocar a cor no mesmo cartão: a camada tem a cor de antes, opaca, por baixo do conteúdo, e some até sair do DOM", async () => {
    restoreMedia = stubReducedMotion(false);
    const { rerender } = render(<Card color="lilac" />);
    rerender(<Card color="peach" />);

    const fade = layer();
    expect(fade).toHaveClass(
      SECTOR_COLOR_BG.lilac,
      "pointer-events-none",
      "absolute",
      "inset-0",
      "-z-10",
    );
    expect(fade).toHaveAttribute("aria-hidden", "true");
    expect(fade?.style.opacity).toBe("1");
    await waitFor(() => expect(layer()).toBeNull());
  });

  it("o cartão que monta logo depois de outro sair (a troca de setor remonta) parte da cor do que saiu", async () => {
    restoreMedia = stubReducedMotion(false);
    const { rerender } = render(<Card color="lilac" id="a" />);
    rerender(<Card color="sky" id="b" />);

    expect(layer()).toHaveClass(SECTOR_COLOR_BG.lilac);
    await waitFor(() => expect(layer()).toBeNull());
  });

  it(`depois de ${REMOUNT_WINDOW_MS} ms a cor do cartão que saiu não vale mais`, () => {
    restoreMedia = stubReducedMotion(false);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const { unmount } = render(<Card color="lilac" />);
    unmount();
    now.mockReturnValue(1_000 + REMOUNT_WINDOW_MS + 1);
    render(<Card color="peach" />);
    expect(layer()).toBeNull();
  });

  it("com movimento reduzido a cor troca na hora: nenhuma camada, nem na troca nem na remontagem", async () => {
    restoreMedia = stubReducedMotion(true);
    const { rerender } = render(<Card color="lilac" id="a" />);
    rerender(<Card color="peach" id="a" />);
    expect(layer()).toBeNull();
    rerender(<Card color="sky" id="b" />);
    expect(layer()).toBeNull();
    await wait(50);
    expect(layer()).toBeNull();
  });
});
