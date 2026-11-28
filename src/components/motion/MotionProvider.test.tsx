import { render, screen, waitFor } from "@testing-library/react";
import { MotionConfigContext, motion } from "motion/react";
import * as m from "motion/react-m";
import { Component, type ReactNode, useContext } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOTION_DEFAULT_TRANSITION } from "@/lib/motion";
import { wait } from "../../../test/motion";
import { MotionProvider } from "./MotionProvider";

// O provider da raiz (library-docs §23): só contexto (nenhum elemento, nenhum script), movimento
// reduzido do aparelho, transição padrão curta, as animações do domAnimation e o `strict`.

class Catcher extends Component<
  { children: ReactNode },
  { message: string | null }
> {
  state: { message: string | null } = { message: null };
  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) };
  }
  render() {
    return this.state.message === null ? (
      this.props.children
    ) : (
      <p role="alert">{this.state.message}</p>
    );
  }
}

function ConfigProbe() {
  const { reducedMotion, transition } = useContext(MotionConfigContext);
  return (
    <output aria-label="config">
      {JSON.stringify({ reducedMotion, transition })}
    </output>
  );
}

describe("MotionProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("é só contexto: no servidor não acrescenta elemento nem script", () => {
    expect(
      renderToString(
        <MotionProvider>
          <p>conteúdo</p>
        </MotionProvider>,
      ),
    ).toBe("<p>conteúdo</p>");
  });

  it("segue o movimento reduzido do aparelho e dá a transição curta padrão", () => {
    render(
      <MotionProvider>
        <ConfigProbe />
      </MotionProvider>,
    );
    expect(
      JSON.parse(screen.getByLabelText("config").textContent ?? "{}"),
    ).toEqual({ reducedMotion: "user", transition: MOTION_DEFAULT_TRANSITION });
  });

  it("carrega as animações: dentro dele o m anima; fora, fica parado no initial", async () => {
    render(
      <>
        <MotionProvider>
          <m.div
            data-testid="dentro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0 }}
          />
        </MotionProvider>
        <m.div
          data-testid="fora"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0 }}
        />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("dentro").style.opacity).toBe("1"),
    );
    await wait(100);
    expect(screen.getByTestId("fora").style.opacity).toBe("0");
  });

  it("strict: o motion pronto dentro dele lança (só m)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Catcher>
        <MotionProvider>
          <motion.div />
        </MotionProvider>
      </Catcher>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/LazyMotion/);
  });
});
