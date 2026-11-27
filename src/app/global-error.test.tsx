import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import GlobalError from "@/app/global-error";

// O limite de erro é trocado por um espião: aqui só se prova que o
// global-error chama o ponto único de log (a captura no Sentry mora lá).
const logging = vi.hoisted(() => ({ logServerError: vi.fn() }));
vi.mock("@/lib/logServerError", () => logging);

// No jsdom o React 19 renderiza <html> e <body> nos singletons do document
// (não há RSC). O único aviso aceito é o de <html> dentro de <div>: qualquer
// outro console.error reprova o teste.
const HTML_NESTING_WARNING = "In HTML, %s cannot be a child of <%s>";

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  logging.logServerError.mockClear();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  const unexpected = consoleError.mock.calls.filter(
    ([message]) =>
      typeof message !== "string" || !message.startsWith(HTML_NESTING_WARNING),
  );
  consoleError.mockRestore();
  expect(unexpected).toEqual([]);
});

describe("global-error.tsx", () => {
  it("é o documento inteiro: lang pt-BR, título e a mensagem", () => {
    render(<GlobalError error={new Error("falha")} retry={vi.fn()} />);

    expect(document.documentElement.lang).toBe("pt-BR");
    expect(document.title).toBe("Algo deu errado");
    expect(
      screen.getByRole("heading", { name: "Algo deu errado" }),
    ).toBeInTheDocument();
  });

  it("'Tentar de novo' chama retry uma vez", async () => {
    const retry = vi.fn();
    render(<GlobalError error={new Error("falha")} retry={retry} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("registra o erro uma vez pelo logServerError, com o contexto global-error", () => {
    const error = new Error("falha");

    render(<GlobalError error={error} retry={vi.fn()} />);

    expect(logging.logServerError).toHaveBeenCalledTimes(1);
    expect(logging.logServerError).toHaveBeenCalledWith(error, "global-error");
  });

  it("nunca mostra a mensagem do erro", () => {
    render(
      <GlobalError
        error={new Error("senha do banco: hunter2")}
        retry={vi.fn()}
      />,
    );

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
  });

  it("aceita erro que não é Error (o tipo da prop é unknown)", () => {
    render(<GlobalError error="texto solto" retry={vi.fn()} />);

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(logging.logServerError).toHaveBeenCalledWith(
      "texto solto",
      "global-error",
    );
  });
});
