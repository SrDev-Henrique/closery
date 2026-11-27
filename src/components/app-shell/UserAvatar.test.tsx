import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./UserAvatar";

const SRC = "data:image/svg+xml;charset=utf-8,%3Csvg%3E%3C/svg%3E";

function parts(container: HTMLElement): {
  frame: HTMLElement;
  img: HTMLImageElement;
} {
  const frame = container.firstElementChild;
  const img = container.querySelector("img");
  if (!(frame instanceof HTMLElement) || !img) {
    throw new Error("UserAvatar não renderizou moldura e imagem");
  }
  return { frame, img };
}

describe("UserAvatar — tamanhos, padding e raios (protótipo Inicio.dc.html)", () => {
  it.each([
    [34, "size-[34px]", "p-[2.5px]", "rounded-[11px]", "rounded-[9px]", 29],
    [36, "size-[36px]", "p-[2.5px]", "rounded-[12px]", "rounded-[10px]", 31],
    [44, "size-[44px]", "p-[3px]", "rounded-[15px]", "rounded-[12px]", 38],
    [52, "size-[52px]", "p-[3px]", "rounded-[17px]", "rounded-[14px]", 46],
    [84, "size-[84px]", "p-1", "rounded-[26px]", "rounded-[22px]", 76],
  ] as const)("size=%s: moldura %s %s %s, imagem %s e %spx de lado", (size, sizeClass, padding, frameRadius, imgRadius, inner) => {
    const { container } = render(<UserAvatar src={SRC} size={size} />);
    const { frame, img } = parts(container);
    expect(frame).toHaveClass(sizeClass, padding, frameRadius, "flex-none");
    expect(img).toHaveClass(imgRadius, "size-full");
    expect(img).toHaveAttribute("width", String(inner));
    expect(img).toHaveAttribute("height", String(inner));
  });
});

describe("UserAvatar — imagem decorativa", () => {
  it('usa <img alt=""> com o data URI recebido e não arrastável', () => {
    const { container } = render(<UserAvatar src={SRC} size={44} />);
    const { img } = parts(container);
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("src", SRC);
    expect(img).toHaveAttribute("draggable", "false");
  });

  it("não expõe nada na árvore de acessibilidade (o nome sempre aparece ao lado)", () => {
    const { getByRole, queryByRole } = render(
      <UserAvatar src={SRC} size={44} />,
    );
    expect(queryByRole("img")).toBeNull();
    expect(getByRole("presentation", { hidden: true })).toBeInTheDocument();
  });
});

describe("UserAvatar — moldura e inclinação", () => {
  it("moldura padrão usa bg-frame", () => {
    const { container } = render(<UserAvatar src={SRC} size={44} />);
    const { frame } = parts(container);
    expect(frame).toHaveClass("bg-frame");
    expect(frame).not.toHaveClass("bg-on-pastel");
  });

  it("frame=on-pastel usa bg-on-pastel (sobre os cards coloridos)", () => {
    const { container } = render(
      <UserAvatar src={SRC} size={52} frame="on-pastel" />,
    );
    const { frame } = parts(container);
    expect(frame).toHaveClass("bg-on-pastel");
    expect(frame).not.toHaveClass("bg-frame");
  });

  it("tilt gira a moldura em graus (negativo e positivo)", () => {
    const { container, rerender } = render(
      <UserAvatar src={SRC} size={44} tilt={-4} />,
    );
    expect(parts(container).frame.style.transform).toBe("rotate(-4deg)");
    rerender(<UserAvatar src={SRC} size={36} tilt={3} />);
    expect(parts(container).frame.style.transform).toBe("rotate(3deg)");
  });

  it("sem tilt (ou tilt 0) não escreve transform", () => {
    const { container, rerender } = render(<UserAvatar src={SRC} size={34} />);
    expect(parts(container).frame.style.transform).toBe("");
    rerender(<UserAvatar src={SRC} size={34} tilt={0} />);
    expect(parts(container).frame.style.transform).toBe("");
  });

  it("className de quem usa entra na moldura sem perder as classes fixas", () => {
    const { container } = render(
      <UserAvatar src={SRC} size={84} className="mb-2" />,
    );
    expect(parts(container).frame).toHaveClass(
      "mb-2",
      "size-[84px]",
      "bg-frame",
    );
  });
});
