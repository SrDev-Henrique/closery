import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/app-shell/ThemeProvider";
import { guardConsoleError } from "../../../test/consoleErrorGuard";

let guard: ReturnType<typeof guardConsoleError>;

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <div>
      <output aria-label="tema">{theme}</output>
      <output aria-label="resolvido">{resolvedTheme}</output>
      <button type="button" onClick={() => setTheme("light")}>
        claro
      </button>
    </div>
  );
}

function setup() {
  return render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  );
}

function prefersDark(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: matches && query.includes("dark"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => {
  guard = guardConsoleError();
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  prefersDark(false);
});

afterEach(() => {
  expect(guard.unexpected).toEqual([]);
  guard.restore();
  prefersDark(false);
});

describe("ThemeProvider", () => {
  it("renderiza os filhos", () => {
    setup();
    expect(screen.getByRole("button", { name: "claro" })).toBeInTheDocument();
  });

  it("o escuro é o padrão: sem escolha guardada, o <html> recebe a classe dark", () => {
    setup();
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByLabelText("tema")).toHaveTextContent("dark");
    expect(localStorage.getItem("closery-tema")).toBeNull();
  });

  it("a escolha guardada em closery-tema vale: light troca a classe", () => {
    localStorage.setItem("closery-tema", "light");
    setup();
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("não segue o sistema: com o sistema em claro ou em escuro, sem escolha, continua dark", () => {
    prefersDark(false);
    const first = setup();
    expect(document.documentElement).toHaveClass("dark");
    first.unmount();

    document.documentElement.className = "";
    prefersDark(true);
    setup();
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByLabelText("resolvido")).toHaveTextContent("dark");
  });

  it("setTheme grava no armazenamento do navegador, na chave closery-tema", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "claro" }));
    expect(localStorage.getItem("closery-tema")).toBe("light");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("o script anti-flash usa a chave e o atributo de classe", () => {
    setup();
    const script = document.querySelector("script");
    expect(script?.innerHTML).toContain("closery-tema");
    expect(script?.innerHTML).toContain('"class"');
  });
});
