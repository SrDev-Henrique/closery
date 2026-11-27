import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AvatarStack, type StackedAvatar } from "./AvatarStack";

const ENTREGOU: StackedAvatar = {
  id: "entregou",
  src: "data:image/svg+xml,ana",
  tilt: 3,
};
const CONFIRMOU: StackedAvatar = {
  id: "confirmou",
  src: "data:image/svg+xml,bruno",
  tilt: -4,
};
const TERCEIRA: StackedAvatar = {
  id: "terceira",
  src: "data:image/svg+xml,carla",
};

/** As molduras (o `div` do `UserAvatar`), na ordem do DOM. */
function framesOf(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("img")).map((img) => {
    const frame = img.parentElement;
    if (!(frame instanceof HTMLElement)) throw new Error("moldura ausente");
    return frame;
  });
}

describe("AvatarStack", () => {
  it("lista vazia não desenha nada", () => {
    const { container } = render(<AvatarStack avatars={[]} size={36} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("um avatar: o invólucro não encolhe e centra, e o avatar fica por cima, sem recuo", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU]} size={36} frame="on-pastel" />,
    );

    const stack = container.firstElementChild;
    expect(stack).toHaveAttribute("data-slot", "avatar-stack");
    expect(stack).toHaveClass("flex", "flex-none", "items-center");
    const [only, ...rest] = framesOf(container);
    expect(rest).toHaveLength(0);
    expect(only).toHaveClass("relative", "z-1", "size-[36px]", "bg-on-pastel");
    expect(only).not.toHaveClass("-ml-2");
    expect(only?.style.transform).toBe("rotate(3deg)");
  });

  it("dois avatares, na ordem recebida: o primeiro por cima (z-index 1) e o segundo 8px sobreposto, cada um com a sua inclinação", () => {
    const { container } = render(
      <AvatarStack
        avatars={[ENTREGOU, CONFIRMOU]}
        size={36}
        frame="on-pastel"
      />,
    );

    expect(
      Array.from(container.querySelectorAll("img")).map((img) =>
        img.getAttribute("src"),
      ),
    ).toEqual([ENTREGOU.src, CONFIRMOU.src]);
    const [first, second] = framesOf(container);
    expect(first).toHaveClass("relative", "z-1");
    expect(first).not.toHaveClass("-ml-2");
    expect(second).toHaveClass("-ml-2");
    expect(second).not.toHaveClass("z-1");
    expect(first?.style.transform).toBe("rotate(3deg)");
    expect(second?.style.transform).toBe("rotate(-4deg)");
  });

  it("três ou mais: o primeiro continua por cima e todos depois dele recuam 8px; sem tilt, sem transform", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU, CONFIRMOU, TERCEIRA]} size={34} />,
    );

    const frames = framesOf(container);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toHaveClass("relative", "z-1");
    expect(frames[1]).toHaveClass("-ml-2");
    expect(frames[2]).toHaveClass("-ml-2");
    expect(frames[2]?.style.transform).toBe("");
  });

  it("sem frame, a moldura é a padrão (bg-frame); o tamanho chega a todos", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU, CONFIRMOU]} size={44} />,
    );

    for (const frame of framesOf(container)) {
      expect(frame).toHaveClass("bg-frame", "size-[44px]");
      expect(frame).not.toHaveClass("bg-on-pastel");
    }
  });

  it("className de quem usa entra no invólucro sem perder as classes fixas", () => {
    const { container } = render(
      <AvatarStack avatars={[ENTREGOU]} size={36} className="mt-1" />,
    );

    expect(container.firstElementChild).toHaveClass(
      "mt-1",
      "flex",
      "flex-none",
      "items-center",
    );
  });

  it("é decorativa: nenhuma imagem na árvore de acessibilidade (o nome está no texto ao lado)", () => {
    const { container, queryByRole } = render(
      <AvatarStack avatars={[ENTREGOU, CONFIRMOU]} size={36} />,
    );

    expect(queryByRole("img")).toBeNull();
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img).toHaveAttribute("alt", "");
    }
  });
});
