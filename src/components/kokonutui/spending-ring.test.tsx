import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type RingSlice,
  ringSpans,
  SpendingRing,
  type SpendingRingProps,
} from "./spending-ring";

const LEGEND = "Legenda da situação das passagens";

const SLICES: RingSlice[] = [
  {
    key: "confirmed",
    label: "Confirmadas",
    value: 1200,
    href: "/passagens?situacao=confirmada",
    strokeClass: "stroke-success-foreground",
    dotClass: "bg-success-foreground",
  },
  {
    key: "awaiting",
    label: "Aguardando recebimento",
    value: 300,
    href: "/passagens?situacao=aguardando",
    strokeClass: "stroke-info-foreground",
    dotClass: "bg-info-foreground",
  },
  {
    key: "unconfirmed",
    label: "Não confirmadas",
    value: 40,
    href: "/passagens?situacao=nao-confirmada",
    strokeClass: "stroke-warning-foreground",
    dotClass: "bg-warning-foreground",
  },
  {
    key: "missing",
    label: "Sem passagem",
    value: 0,
    href: "/passagens?situacao=sem-passagem",
    strokeClass: "stroke-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
];

function ring(overrides: Partial<SpendingRingProps> = {}): SpendingRingProps {
  return {
    title: "Situação das passagens",
    legendLabel: LEGEND,
    total: 1540,
    totalHref: "/passagens",
    slices: SLICES,
    emptyText: "Nenhum turno encerrado no período.",
    ...overrides,
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error");
});
afterEach(() => {
  expect(errorSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
  vi.restoreAllMocks();
});

describe("ringSpans", () => {
  const GAP = 2.4;
  const MIN = 3;
  const sweepSum = (spans: ReturnType<typeof ringSpans>) =>
    spans.reduce((acc, span) => acc + (span.to - span.from), 0);

  it("fatias zeradas não desenham e o índice de origem é preservado", () => {
    const spans = ringSpans([10, 0, 30, 0], 40, GAP, MIN);
    expect(spans.map((span) => span.index)).toEqual([0, 2]);
  });

  it("a soma dos arcos é 360 menos os vãos, do primeiro ao último grau", () => {
    const spans = ringSpans([1200, 300, 40, 0], 1540, GAP, MIN);
    expect(spans).toHaveLength(3);
    expect(sweepSum(spans)).toBeCloseTo(360 - 3 * GAP, 6);
    expect(spans[0]?.from).toBeCloseTo(GAP / 2, 6);
    expect(spans.at(-1)?.to).toBeCloseTo(360 - GAP / 2, 6);
    for (const [i, span] of spans.entries()) {
      const next = spans[i + 1];
      if (next) {
        expect(next.from - span.to).toBeCloseTo(GAP, 6);
      }
    }
  });

  it("uma fatia minúscula nunca fica abaixo do mínimo nem inverte o arco (100000 contra 1)", () => {
    const spans = ringSpans([100000, 1], 100001, GAP, MIN);
    expect(spans[1] ? spans[1].to - spans[1].from : 0).toBeCloseTo(MIN, 6);
    expect(sweepSum(spans)).toBeCloseTo(360 - 2 * GAP, 6);
    for (const span of spans) {
      expect(span.to).toBeGreaterThan(span.from);
    }
  });

  it("uma fatia só ocupa o anel inteiro, menos o vão", () => {
    const spans = ringSpans([0, 5], 5, GAP, MIN);
    expect(spans).toEqual([{ index: 1, from: GAP / 2, to: 360 - GAP / 2 }]);
  });

  it("sem total ou sem valor não há arco", () => {
    expect(ringSpans([0, 0], 0, GAP, MIN)).toEqual([]);
    expect(ringSpans([], 0, GAP, MIN)).toEqual([]);
    expect(ringSpans([5], 0, GAP, MIN)).toEqual([]);
  });
});

describe("SpendingRing", () => {
  it("a legenda lista as quatro fatias, inclusive a zerada, cada uma com link e número exato", () => {
    render(<SpendingRing {...ring()} />);
    const legend = screen.getByRole("list", { name: LEGEND });
    const links = within(legend).getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      SLICES.map((slice) => slice.href),
    );
    expect(
      within(legend).getByRole("link", { name: "Confirmadas: 1.200 (78%)" }),
    ).toBeInTheDocument();
    expect(
      within(legend).getByRole("link", { name: "Sem passagem: 0 (0%)" }),
    ).toBeInTheDocument();
  });

  it("mostra o total do servidor e a fatia selecionada no centro", () => {
    render(<SpendingRing {...ring()} />);
    expect(screen.getByText("1.540")).toBeInTheDocument();
    expect(screen.getByText("78% do total")).toBeInTheDocument();
    const slider = screen.getByRole("slider", {
      name: "Situação das passagens. Use as setas para girar o anel.",
    });
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Confirmadas: 1.200 (78%)",
    );
    expect(slider).toHaveAttribute("aria-valuemax", "3");
  });

  it("o anel não soma as fatias: usa o total que o servidor mandou", () => {
    render(<SpendingRing {...ring({ total: 2000 })} />);
    expect(screen.getByText("2.000")).toBeInTheDocument();
    // 1.200 de 2.000 = 60%.
    expect(screen.getByText("60% do total")).toBeInTheDocument();
  });

  it("setas, Home e End giram o anel e mudam o valuetext", async () => {
    const user = userEvent.setup();
    render(<SpendingRing {...ring()} />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Aguardando recebimento: 300 (19%)",
    );
    await user.keyboard("{End}");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Não confirmadas: 40 (3%)",
    );
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Confirmadas: 1.200 (78%)",
    );
    await user.keyboard("{ArrowLeft}");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Não confirmadas: 40 (3%)",
    );
    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Confirmadas: 1.200 (78%)",
    );
  });

  it("foco e hover numa linha da legenda selecionam a fatia (a zerada não)", async () => {
    const user = userEvent.setup();
    render(<SpendingRing {...ring()} />);
    const slider = screen.getByRole("slider");
    const legend = screen.getByRole("list", { name: LEGEND });
    await user.hover(
      within(legend).getByRole("link", { name: /Não confirmadas/ }),
    );
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Não confirmadas: 40 (3%)",
    );
    const awaiting = within(legend).getByRole("link", {
      name: /Aguardando recebimento/,
    });
    await act(async () => {
      awaiting.focus();
    });
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Aguardando recebimento: 300 (19%)",
    );
    await user.hover(
      within(legend).getByRole("link", { name: /Sem passagem/ }),
    );
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Aguardando recebimento: 300 (19%)",
    );
  });

  it("o total do cabeçalho é um link para a lista, com nome acessível", () => {
    render(<SpendingRing {...ring({ totalHref: "/passagens?periodo=7" })} />);
    const link = screen.getByRole("link", {
      name: "1.540 passagens: ver a lista",
    });
    expect(link).toHaveAttribute("href", "/passagens?periodo=7");
    expect(link).toHaveTextContent("1.540");
  });

  it("o total do cabeçalho tem alvo de toque de 44px no celular, inclusive para o 0, que é curto (P12)", () => {
    render(<SpendingRing {...ring({ total: 0 })} />);

    const link = screen.getByRole("link", { name: /passagens: ver a lista/ });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:min-w-11",
      "max-md:items-center",
      "max-md:justify-end",
    );
    expect(link).toHaveClass("tabular-nums", "hover:underline");
  });

  it("total 0: o 0 também é um link para a lista", () => {
    render(
      <SpendingRing
        {...ring({
          total: 0,
          totalHref: "/passagens?periodo=7",
          slices: SLICES.map((slice) => ({ ...slice, value: 0 })),
        })}
      />,
    );
    const link = screen.getByRole("link", { name: "0 passagens: ver a lista" });
    expect(link).toHaveAttribute("href", "/passagens?periodo=7");
  });

  it("total 0: mostra o texto de vazio no lugar do anel, mas a legenda segue com os links", () => {
    render(
      <SpendingRing
        {...ring({
          total: 0,
          slices: SLICES.map((slice) => ({ ...slice, value: 0 })),
        })}
      />,
    );
    expect(
      screen.getByText("Nenhum turno encerrado no período."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const links = within(
      screen.getByRole("list", { name: LEGEND }),
    ).getAllByRole("link");
    expect(links).toHaveLength(4);
  });

  it("uma fatia só e fatia minúscula desenham sem NaN", () => {
    const { container, rerender } = render(
      <SpendingRing
        {...ring({
          total: 7,
          slices: SLICES.map((slice, i) => ({
            ...slice,
            value: i === 1 ? 7 : 0,
          })),
        })}
      />,
    );
    expect(container.querySelectorAll("svg g path").length).toBe(1);
    expect(container.innerHTML).not.toContain("NaN");
    rerender(
      <SpendingRing
        {...ring({
          total: 100001,
          slices: SLICES.map((slice, i) => ({
            ...slice,
            value: i === 0 ? 100000 : i === 1 ? 1 : 0,
          })),
        })}
      />,
    );
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("movimento reduzido: girar o anel não agenda animação", async () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const user = userEvent.setup();
    render(<SpendingRing {...ring()} />);
    const slider = screen.getByRole("slider");
    slider.focus();
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute(
      "aria-valuetext",
      "Aguardando recebimento: 300 (19%)",
    );
    expect(raf).not.toHaveBeenCalled();
  });

  it("só português e só tokens, com ícone na legenda quando a fatia traz um", () => {
    const { container } = render(
      <SpendingRing
        {...ring({
          slices: SLICES.map((slice) => ({
            ...slice,
            icon: <svg aria-hidden data-testid={`icon-${slice.key}`} />,
          })),
        })}
      />,
    );
    expect(screen.getAllByTestId(/^icon-/)).toHaveLength(4);
    expect(container.textContent).not.toMatch(/vs previous|Spending|\$/);
    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|stroke|fill|border|ring)-(?:zinc|emerald|rose|orange|slate|gray|white|black)\b/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
