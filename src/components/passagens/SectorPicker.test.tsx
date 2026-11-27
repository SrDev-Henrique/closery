import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { redirect } from "next/navigation";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SECTOR_COLOR_BG } from "@/features/sectors/colors";

import { SectorPicker } from "./SectorPicker";

const mocks = vi.hoisted(() => ({
  chooseSectorAction: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/actions", () => ({
  chooseSectorAction: mocks.chooseSectorAction,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const ULD = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "ULD",
  color: "lilac",
} as const;
const CARGA = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Carga",
  color: "peach",
} as const;
const OPERACOES = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Operações",
  color: "sky",
} as const;
const ECO = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Eco",
  color: "green",
} as const;
const GELO = {
  id: "55555555-5555-4555-8555-555555555555",
  name: "Gelo",
  color: "pink",
} as const;

class Catcher extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? <p>capturado</p> : this.props.children;
  }
}

function radio(name: string) {
  return screen.getByRole("radio", { name });
}

describe("SectorPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.chooseSectorAction.mockReset();
    mocks.toastError.mockReset();
  });

  it("é um radiogroup 'Setor' com um radio por setor, o selecionado com aria-checked", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    const group = screen.getByRole("radiogroup", { name: "Setor" });
    expect(within(group).getAllByRole("radio")).toHaveLength(2);
    expect(radio("ULD")).toHaveAttribute("aria-checked", "true");
    expect(radio("Carga")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("cada setor leva a bolinha na cor dele, o thumb fica no índice do selecionado", () => {
    render(
      <SectorPicker
        sectors={[ULD, CARGA, OPERACOES]}
        selectedId={CARGA.id}
        path="/"
      />,
    );

    for (const [name, color] of [
      ["ULD", ULD.color],
      ["Carga", CARGA.color],
      ["Operações", OPERACOES.color],
    ] as const) {
      const dot = radio(name).querySelector("[data-sector-dot]");
      expect(dot).not.toBeNull();
      for (const token of SECTOR_COLOR_BG[color].split(" ")) {
        expect(dot).toHaveClass(token);
      }
    }
    const thumb = document.querySelector<HTMLElement>(
      "[data-slot=sector-picker-thumb]",
    );
    expect(thumb).not.toBeNull();
    expect(thumb?.style.getPropertyValue("--i")).toBe("1");
    expect(thumb).not.toHaveClass("opacity-0");
    expect(
      screen
        .getByRole("radiogroup", { name: "Setor" })
        .style.getPropertyValue("--n"),
    ).toBe("3");
  });

  it("o thumb desliza sem animação para quem pede menos movimento", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    const thumb = document.querySelector("[data-slot=sector-picker-thumb]");
    expect(thumb).toHaveClass("motion-reduce:transition-none");
    expect(thumb).toHaveClass("transition-[left]");
    // A sombra é o token da Task 1, nunca rgba() no .tsx.
    expect(thumb).toHaveClass("shadow-thumb", "bg-thumb");
  });

  it("clicar em outro setor chama a action com setor e caminho", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens/nova"
      />,
    );

    await userEvent.click(radio("Carga"));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens/nova",
    });
  });

  it("com query, a action recebe o query dos filtros junto (P45)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens"
        query="periodo=30&situacao=aguardando"
      />,
    );

    await userEvent.click(radio("Carga"));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens",
      query: "periodo=30&situacao=aguardando",
    });
  });

  it("com query vazio, a action recebe o query vazio (a tela sem filtros)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/solicitacoes"
        query=""
      />,
    );

    await userEvent.click(radio("Carga"));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/solicitacoes",
      query: "",
    });
  });

  it("clicar no setor já selecionado não chama a action", async () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("ULD"));

    expect(mocks.chooseSectorAction).not.toHaveBeenCalled();
  });

  it("as setas do teclado trocam de setor (radio nativo)", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.tab();
    expect(radio("ULD")).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}");

    await waitFor(() =>
      expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
        sectorId: CARGA.id,
        path: "/",
      }),
    );
  });

  it("durante a troca o thumb já vai ao setor novo, o grupo fica desativado e os segmentos mais claros", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    mocks.chooseSectorAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("Carga"));

    await waitFor(() =>
      expect(radio("Carga")).toHaveAttribute("aria-checked", "true"),
    );
    expect(screen.getByRole("radiogroup", { name: "Setor" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(radio("ULD")).toHaveClass("opacity-60");
    expect(radio("Carga")).toHaveClass("opacity-60");
    expect(
      document
        .querySelector<HTMLElement>("[data-slot=sector-picker-thumb]")
        ?.style.getPropertyValue("--i"),
    ).toBe("1");

    // Pendente: outro clique não chama a action de novo.
    await userEvent.click(radio("ULD"));
    expect(mocks.chooseSectorAction).toHaveBeenCalledTimes(1);

    finish({ ok: true });
    await waitFor(() =>
      expect(
        screen.getByRole("radiogroup", { name: "Setor" }),
      ).not.toHaveAttribute("aria-disabled"),
    );
  });

  it("falha da action vira toast com a mensagem e o thumb volta ao setor de antes", async () => {
    mocks.chooseSectorAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("Carga"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    );
    await waitFor(() =>
      expect(radio("ULD")).toHaveAttribute("aria-checked", "true"),
    );
    expect(radio("Carga")).toHaveAttribute("aria-checked", "false");
  });

  it("exceção de rede vira o toast genérico", async () => {
    mocks.chooseSectorAction.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(radio("Carga"));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível concluir. Tente de novo.",
      ),
    );
  });

  it("o redirect do sucesso segue adiante: sem toast", async () => {
    mocks.chooseSectorAction.mockImplementation(async () => {
      redirect("/?setor=x");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Catcher>
        <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />
      </Catcher>,
    );

    await userEvent.click(radio("Carga"));

    expect(await screen.findByText("capturado")).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("allowAll acrescenta 'Todos os setores', sem bolinha, e escolher um setor chama a action", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD]}
        selectedId="todos"
        path="/passagens"
        allowAll
      />,
    );

    expect(radio("Todos os setores")).toHaveAttribute("aria-checked", "true");
    expect(
      radio("Todos os setores").querySelector("[data-sector-dot]"),
    ).toBeNull();
    expect(radio("ULD").querySelector("[data-sector-dot]")).not.toBeNull();

    await userEvent.click(radio("ULD"));
    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: ULD.id,
      path: "/passagens",
    });
  });

  it("allowAll com lista vazia deixa só 'Todos os setores'", () => {
    render(
      <SectorPicker
        sectors={[]}
        selectedId="todos"
        path="/passagens"
        allowAll
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(1);
    expect(radio("Todos os setores")).toHaveAttribute("aria-checked", "true");
  });

  it("o texto visível do 'Todos os setores' é 'Todos', o nome acessível segue inteiro", () => {
    render(
      <SectorPicker
        sectors={[ULD]}
        selectedId="todos"
        path="/passagens"
        allowAll
      />,
    );

    const item = radio("Todos os setores");
    expect(item).toHaveAttribute("aria-label", "Todos os setores");
    expect(within(item).getByText("Todos")).toBeInTheDocument();
    expect(item).not.toHaveTextContent("Todos os setores");
  });

  it("o nome truncado ganha title com o nome inteiro", () => {
    render(
      <SectorPicker
        sectors={[ULD, OPERACOES]}
        selectedId={ULD.id}
        path="/"
        allowAll
      />,
    );
    expect(
      within(radio("Operações")).getByTitle("Operações"),
    ).toBeInTheDocument();
    expect(
      within(radio("Todos os setores")).getByTitle("Todos os setores"),
    ).toBeInTheDocument();
  });

  describe("rolagem do trilho", () => {
    const widths = ["scrollWidth", "clientWidth"] as const;
    const saved = new Map<string, PropertyDescriptor | undefined>();

    beforeEach(() => {
      for (const key of widths) {
        saved.set(
          key,
          Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
        );
      }
      saved.set(
        "scrollTo",
        Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo"),
      );
      saved.set(
        "scrollIntoView",
        Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView"),
      );
    });

    afterEach(() => {
      for (const [key, descriptor] of saved) {
        const target =
          key === "scrollWidth" || key === "clientWidth"
            ? HTMLElement.prototype
            : Element.prototype;
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      }
      saved.clear();
    });

    function overflow(scroll: number, client: number) {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
        configurable: true,
        get: () => scroll,
      });
      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => client,
      });
    }

    // O Base UI também chama scrollTo (com top); as chamadas do seletor só levam left.
    function ours(spy: ReturnType<typeof vi.fn>) {
      return spy.mock.calls.filter(([options]) => !("top" in options));
    }

    function spies() {
      const scrollTo = vi.fn();
      const scrollIntoView = vi.fn();
      Element.prototype.scrollTo = scrollTo;
      Element.prototype.scrollIntoView = scrollIntoView;
      return { scrollTo, scrollIntoView };
    }

    it("rola só o trilho na horizontal, ao montar e a cada troca, sem tocar a janela", () => {
      overflow(1000, 400);
      const { scrollTo, scrollIntoView } = spies();
      const sectors = [ULD, CARGA, OPERACOES, ECO, GELO];
      const { rerender } = render(
        <SectorPicker
          sectors={sectors}
          selectedId={GELO.id}
          path="/"
          allowAll
        />,
      );

      const group = screen.getByRole("radiogroup", { name: "Setor" });
      expect(ours(scrollTo)).toHaveLength(1);
      expect(scrollTo.mock.contexts.at(-1)).toBe(group);
      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({
          left: expect.any(Number),
          behavior: "smooth",
        }),
      );

      rerender(
        <SectorPicker
          sectors={sectors}
          selectedId={ULD.id}
          path="/"
          allowAll
        />,
      );
      expect(ours(scrollTo)).toHaveLength(2);
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("para quem pede menos movimento a rolagem não é suave", () => {
      overflow(1000, 400);
      const { scrollTo } = spies();
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
      render(
        <SectorPicker
          sectors={[ULD, CARGA, OPERACOES, ECO]}
          selectedId={ULD.id}
          path="/"
          allowAll
        />,
      );
      vi.unstubAllGlobals();

      expect(scrollTo).toHaveBeenCalledWith(
        expect.objectContaining({ behavior: "auto" }),
      );
    });

    it("sem transbordo (o trilho cabe) não rola", () => {
      overflow(400, 400);
      const { scrollTo } = spies();
      render(
        <SectorPicker
          sectors={[ULD, CARGA, OPERACOES, ECO, GELO]}
          selectedId={GELO.id}
          path="/"
        />,
      );
      expect(ours(scrollTo)).toHaveLength(0);
    });

    it("até 4 opções não há rolagem para acompanhar", () => {
      overflow(1000, 400);
      const { scrollTo } = spies();
      render(
        <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
      );
      expect(ours(scrollTo)).toHaveLength(0);
    });

    it("sem a API de rolagem (jsdom puro) não quebra", () => {
      overflow(1000, 400);
      Reflect.deleteProperty(Element.prototype, "scrollTo");
      expect(() =>
        render(
          <SectorPicker
            sectors={[ULD, CARGA, OPERACOES, ECO, GELO]}
            selectedId={GELO.id}
            path="/"
          />,
        ),
      ).not.toThrow();
    });
  });

  it("sem allowAll não há 'Todos os setores'", () => {
    render(<SectorPicker sectors={[ULD]} selectedId={ULD.id} path="/" />);

    expect(
      screen.queryByRole("radio", { name: "Todos os setores" }),
    ).not.toBeInTheDocument();
  });

  it("selecionado fora da lista: nenhum radio marcado e o thumb escondido", () => {
    render(<SectorPicker sectors={[ULD, CARGA]} selectedId="outro" path="/" />);

    for (const item of screen.getAllByRole("radio")) {
      expect(item).toHaveAttribute("aria-checked", "false");
    }
    expect(
      document.querySelector("[data-slot=sector-picker-thumb]"),
    ).toHaveClass("opacity-0");
  });

  it("mais de 4 opções: o trilho rola e cada segmento tem largura mínima", () => {
    render(
      <SectorPicker
        sectors={[ULD, CARGA, OPERACOES, ECO, GELO]}
        selectedId={GELO.id}
        path="/"
        allowAll
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Setor" });
    expect(group).toHaveClass("overflow-x-auto");
    expect(group.style.getPropertyValue("--n")).toBe("6");
    for (const item of screen.getAllByRole("radio")) {
      expect(item).toHaveClass("min-w-[6.5rem]");
    }
    expect(
      document
        .querySelector<HTMLElement>("[data-slot=sector-picker-thumb]")
        ?.style.getPropertyValue("--i"),
    ).toBe("4");
  });

  it("até 4 opções os segmentos dividem o trilho sem largura mínima (no celular cabem nos 100%, sem rolar), como no protótipo", () => {
    render(
      <SectorPicker
        sectors={[CARGA, ECO, OPERACOES, ULD]}
        selectedId={ULD.id}
        path="/"
      />,
    );

    for (const item of screen.getAllByRole("radio")) {
      expect(item).not.toHaveClass("min-w-[6.5rem]");
      expect(item).toHaveClass("min-w-0", "flex-1");
    }
    const inner = document.querySelector("[data-slot=sector-picker-thumb]")
      ?.parentElement as HTMLElement;
    expect(inner).not.toHaveClass("min-w-[max(100%,calc(var(--n)*6.5rem))]");
  });

  it("nome longo trunca com reticências, o nome inteiro fica no aria-label", () => {
    const longo = {
      id: "66666666-6666-4666-8666-666666666666",
      name: "Recebimento e conferência de carga especial",
      color: "green",
    } as const;
    render(<SectorPicker sectors={[longo]} selectedId={longo.id} path="/" />);

    const item = radio(longo.name);
    expect(item).toHaveAttribute("aria-label", longo.name);
    expect(within(item).getByText(longo.name)).toHaveClass("truncate");
  });

  it("alvo de toque: 44px abaixo de 860px (guarda de 44px), 40px da spec acima", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    for (const item of screen.getAllByRole("radio")) {
      expect(item).toHaveClass("max-md:h-11");
    }
  });
});
