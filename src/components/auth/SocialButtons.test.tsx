import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SocialButtons } from "./SocialButtons";

describe("SocialButtons", () => {
  it("não renderiza nada sem provedores habilitados", () => {
    const { container } = render(
      <SocialButtons providers={[]} onSelect={vi.fn()} disabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra só os provedores habilitados, na ordem recebida", () => {
    render(
      <SocialButtons
        providers={["google", "facebook"]}
        onSelect={vi.fn()}
        disabled={false}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Continuar com Google",
      "Continuar com Facebook",
    ]);
  });

  it("apenas Facebook habilitado esconde o Google", () => {
    render(
      <SocialButtons
        providers={["facebook"]}
        onSelect={vi.fn()}
        disabled={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Continuar com Google" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    ).toBeInTheDocument();
  });

  it("chama onSelect com o provedor clicado", async () => {
    const onSelect = vi.fn();
    render(
      <SocialButtons
        providers={["google", "facebook"]}
        onSelect={onSelect}
        disabled={false}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("facebook");
  });

  it("desabilita todos os botões e não chama onSelect quando disabled", async () => {
    const onSelect = vi.fn();
    render(
      <SocialButtons
        providers={["google", "facebook"]}
        onSelect={onSelect}
        disabled
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });
});
