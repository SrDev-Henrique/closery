import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/components/app-shell/ThemeProvider";
import { ThemeSwitch } from "@/components/app-shell/ThemeSwitch";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.spyOn(console, "error").mockImplementation(() => {});

function tree() {
  return (
    <TooltipProvider>
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>
    </TooltipProvider>
  );
}

const getSwitch = () => screen.getByRole("switch", { name: "Tema escuro" });

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
});

describe("ThemeSwitch", () => {
  it("é um switch chamado 'Tema escuro', ligado no escuro (o padrão)", () => {
    render(tree());
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    expect(getSwitch()).toHaveAttribute("type", "button");
  });

  it("começa desligado quando a escolha guardada é o claro", () => {
    localStorage.setItem("closery-tema", "light");
    render(tree());
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
  });

  it("clicar troca para o claro e de volta, e a escolha sobrevive no armazenamento", async () => {
    render(tree());

    await userEvent.click(getSwitch());
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem("closery-tema")).toBe("light");

    await userEvent.click(getSwitch());
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("closery-tema")).toBe("dark");
  });

  it("funciona pelo teclado: Tab foca, Espaço e Enter trocam", async () => {
    render(tree());
    await userEvent.tab();
    expect(getSwitch()).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(getSwitch()).toHaveAttribute("aria-checked", "false");
    await userEvent.keyboard("{Enter}");
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("o tooltip diz o que o clique faz: no escuro, 'Mudar para o tema claro'", async () => {
    render(tree());
    hover(getSwitch());
    expect(
      await screen.findByText("Mudar para o tema claro"),
    ).toBeInTheDocument();
  });

  it("o tooltip no claro é 'Mudar para o tema escuro'", async () => {
    localStorage.setItem("closery-tema", "light");
    render(tree());
    hover(getSwitch());
    expect(
      await screen.findByText("Mudar para o tema escuro"),
    ).toBeInTheDocument();
  });

  it("os ícones são decorativos (o nome vem do aria-label)", () => {
    render(tree());
    const icons = getSwitch().querySelectorAll("svg");
    expect(icons.length).toBe(2);
    for (const icon of icons)
      expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("sem ThemeProvider (limite): renderiza no escuro e o clique não lança", async () => {
    render(
      <TooltipProvider>
        <ThemeSwitch />
      </TooltipProvider>,
    );
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
    await userEvent.click(getSwitch());
    expect(getSwitch()).toBeInTheDocument();
  });

  it("hidratação: o HTML do servidor é sempre o escuro, mesmo com o claro guardado", () => {
    localStorage.setItem("closery-tema", "light");
    const html = renderToString(tree());
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('role="switch"');
  });
});
