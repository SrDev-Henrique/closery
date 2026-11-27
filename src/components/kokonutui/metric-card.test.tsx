import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeDelta, deltaText } from "@/features/dashboard/delta";
import {
  MetricCard,
  type MetricCardProps,
  type MetricPoint,
  type MetricSegment,
} from "./metric-card";

const ITEM_HREF =
  "/passagens?situacao=entregues&item=11111111-1111-4111-8111-111111111111";

function segment(
  key: string,
  label: string,
  swatchClass: string,
  strokeClass: string,
  total: number,
  previousTotal: number,
): MetricSegment {
  return {
    key,
    label,
    swatchClass,
    strokeClass,
    total,
    previousTotal,
    href: `${ITEM_HREF}&turno=${key}`,
  };
}

const MORNING = segment(
  "manha",
  "Manhã",
  "bg-chart-1",
  "stroke-chart-1",
  30,
  20,
);
const AFTERNOON = segment(
  "tarde",
  "Tarde",
  "bg-chart-2",
  "stroke-chart-2",
  40,
  50,
);

// 14 dias (2 × 7): de 07/11 a 20/11. Os `total` e as `parts` NÃO batem de propósito (o `total`
// do dia vem do SQL, e o cartão nunca soma as partes): quem somasse no cliente erraria o teste.
const DATES = Array.from({ length: 14 }, (_, i) => {
  const day = 7 + i;
  return `2026-11-${String(day).padStart(2, "0")}`;
});
const TOTALS = [4, 6, 5, 8, 7, 3, 6, 9, 11, 10, 12, 8, 7, 13];
const SERIES: MetricPoint[] = DATES.map((date, i) => ({
  date,
  total: TOTALS[i],
  parts: [1, 2],
}));

function props(overrides: Partial<MetricCardProps> = {}): MetricCardProps {
  return {
    label: "Rede de proteção",
    unit: "peças",
    context: null,
    periodDays: 7,
    total: 70,
    average: 11.7,
    handoverCount: 6,
    delta: computeDelta(70, 50),
    segments: [MORNING, AFTERNOON],
    series: SERIES,
    href: ITEM_HREF,
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

function mockReducedMotion(reduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

describe("MetricCard", () => {
  it("mostra rótulo, unidade, setor, total pt-BR com unidade e o link do total", () => {
    render(<MetricCard {...props({ context: "ULD Teste", total: 1234 })} />);
    expect(screen.getByText("Rede de proteção")).toBeInTheDocument();
    expect(screen.getByText("ULD Teste")).toBeInTheDocument();
    const total = screen.getByRole("link", {
      name: "1.234 peças: ver as passagens do período",
    });
    expect(total).toHaveAttribute("href", ITEM_HREF);
  });

  it("média por turno e a legenda de passagens, que é outro link para a mesma lista", () => {
    render(<MetricCard {...props()} />);
    expect(screen.getByText(/média de 11,7 por turno/)).toBeInTheDocument();
    const count = screen.getByRole("link", { name: "6 passagens" });
    expect(count).toHaveAttribute("href", ITEM_HREF);
  });

  it("usa o singular com uma passagem e não escreve 'média' sem média", () => {
    render(<MetricCard {...props({ handoverCount: 1, average: null })} />);
    expect(
      screen.getByRole("link", { name: "1 passagem" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/média de/)).not.toBeInTheDocument();
  });

  it.each([
    ["up", computeDelta(12, 10)],
    ["down", computeDelta(8, 10)],
    ["same", computeDelta(10, 10)],
    ["none", computeDelta(10, 0)],
  ] as const)("variação %s: ícone e texto, sem cor de bom ou ruim", (_kind, delta) => {
    const { container } = render(<MetricCard {...props({ delta })} />);
    const text = deltaText(delta);
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    const badge = screen.getByRole("img", {
      name:
        delta.kind === "none"
          ? "Sem dados no período anterior para comparar"
          : text,
    });
    expect(badge.className).toContain("text-muted-foreground");
    expect(container.innerHTML).not.toMatch(
      /text-success|text-destructive|text-warning/,
    );
  });

  it("escala rotulada: 0 na base e o maior valor desenhado, com a unidade, no topo", () => {
    render(<MetricCard {...props()} />);
    // O maior dos 14 pontos é 13 (nenhuma soma).
    expect(screen.getByText("13 peças")).toBeInTheDocument();
    expect(
      within(screen.getByRole("slider")).getByText("0"),
    ).toBeInTheDocument();
    expect(screen.getByText("Período atual")).toBeInTheDocument();
    expect(screen.getByText("Período anterior")).toBeInTheDocument();
  });

  it("sem passagens com o item: rótulo, unidade e o texto de vazio, sem gráfico", () => {
    render(
      <MetricCard
        {...props({ handoverCount: 0, average: null, total: 0, series: [] })}
      />,
    );
    expect(screen.getByText("Rede de proteção")).toBeInTheDocument();
    expect(screen.getByText("peças")).toBeInTheDocument();
    expect(screen.getByText("Sem passagens no período")).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("período de 1 dia e série curta renderizam sem erro", () => {
    render(
      <MetricCard
        {...props({
          periodDays: 1,
          series: SERIES.slice(-2),
          total: 13,
          handoverCount: 1,
        })}
      />,
    );
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemax", "1");
    expect(slider.parentElement?.innerHTML).not.toContain("NaN");
  });

  it("um turno só: sem o detalhamento 'Por turno'", () => {
    render(<MetricCard {...props({ segments: [MORNING] })} />);
    expect(screen.queryByText("Por turno")).not.toBeInTheDocument();
  });

  it("seis turnos: seis linhas, todas com link; slots 1 a 4 com cor própria e o 5º e o 6º neutros", () => {
    const six = [
      segment("a", "Turno A", "bg-chart-1", "stroke-chart-1", 6, 1),
      segment("b", "Turno B", "bg-chart-2", "stroke-chart-2", 5, 1),
      segment("c", "Turno C", "bg-chart-3", "stroke-chart-3", 4, 1),
      segment("d", "Turno D", "bg-chart-4", "stroke-chart-4", 3, 1),
      segment("e", "Turno E", "bg-foreground", "stroke-foreground", 2, 1),
      segment("f", "Turno F", "bg-foreground", "stroke-foreground", 1, 1),
    ];
    render(<MetricCard {...props({ segments: six, total: 21 })} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(within(row).getByRole("link")).toHaveAttribute(
        "href",
        expect.stringContaining("turno="),
      );
    }
    const dots = rows.map(
      (row) => row.querySelector("span.size-2")?.className ?? "",
    );
    expect(dots.slice(0, 4).map((c) => c.match(/bg-chart-\d/)?.[0])).toEqual([
      "bg-chart-1",
      "bg-chart-2",
      "bg-chart-3",
      "bg-chart-4",
    ]);
    expect(dots[4]).toContain("bg-foreground");
    expect(dots[5]).toContain("bg-foreground");
    expect(dots.join(" ")).not.toContain("bg-chart-5");
  });

  it("cada turno mostra total (link), participação e o botão de foco com aria-pressed", async () => {
    const user = userEvent.setup();
    render(<MetricCard {...props()} />);
    const link = screen.getByRole("link", {
      name: "30 peças em Manhã: ver as passagens",
    });
    expect(link).toHaveAttribute("href", `${ITEM_HREF}&turno=manha`);
    // 30 de 70 = 43%.
    expect(screen.getByText("43%")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Mostrar só Manhã" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(
      screen.getByRole("button", { name: "Mostrar todos os turnos" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostrando só Manhã: 30 peças",
    );
  });

  it("foco num turno: o número e a variação são do turno (prontos do servidor), a linha usa a cor do turno e nenhum swatch muda de classe", async () => {
    const user = userEvent.setup();
    const { container } = render(<MetricCard {...props()} />);
    const swatches = () =>
      Array.from(container.querySelectorAll("li span.size-2")).map(
        (node) => node.className,
      );
    const before = swatches();
    expect(
      container.querySelector("path.stroke-foreground:not(.opacity-25)"),
    ).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Mostrar só Manhã" }));

    // O número grande vira o total do turno (30), com o link do turno.
    expect(
      screen.queryByRole("link", {
        name: "30 peças: ver as passagens do período",
      }),
    ).not.toBeInTheDocument();
    const big = screen.getAllByRole("link", {
      name: "30 peças em Manhã: ver as passagens",
    });
    // O número grande e a linha do turno abrem a mesma lista.
    expect(big).toHaveLength(2);
    for (const link of big) {
      expect(link).toHaveAttribute("href", `${ITEM_HREF}&turno=manha`);
    }
    // Variação do turno: 30 contra 20 = +50%, e não a do item (+40%).
    expect(
      screen.getByRole("img", { name: deltaText(computeDelta(30, 20)) }),
    ).toBeInTheDocument();
    expect(
      container.querySelector("path.stroke-chart-1:not(.opacity-25)"),
    ).not.toBeNull();
    expect(container.querySelector("path.stroke-foreground")).toBeNull();
    // Mesmas classes de antes: nem "tinta" no foco, nem ciclo por índice.
    expect(swatches()).toEqual(before);
    // A escala vira a do turno: o maior valor desenhado de `parts[0]` é 1.
    expect(screen.getByText("1 peças")).toBeInTheDocument();
  });

  it("setas, Home e End leem um dia por vez; Escape e o botão voltam ao período", async () => {
    const user = userEvent.setup();
    render(<MetricCard {...props()} />);
    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuetext", "70 peças no período");
    slider.focus();
    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute("aria-valuetext", "14/11/2026: 9 peças");
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuetext", "15/11/2026: 11 peças");
    await user.keyboard("{End}");
    expect(slider).toHaveAttribute("aria-valuetext", "20/11/2026: 13 peças");
    await user.keyboard("{ArrowLeft}");
    expect(slider).toHaveAttribute("aria-valuetext", "19/11/2026: 7 peças");
    // O dia gêmeo do período anterior é o do mesmo índice (7 dias antes).
    expect(screen.getByText("19/11/2026 vs 12/11/2026")).toBeInTheDocument();
    // O número lido é de um dia: deixa de ser o link do período.
    expect(
      screen.queryByRole("link", {
        name: "7 peças: ver as passagens do período",
      }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(slider).toHaveAttribute("aria-valuetext", "70 peças no período");
    await user.keyboard("{ArrowLeft}");
    await user.click(screen.getByRole("button", { name: "Voltar ao período" }));
    expect(slider).toHaveAttribute("aria-valuetext", "70 peças no período");
    expect(
      screen.getByRole("link", {
        name: "70 peças: ver as passagens do período",
      }),
    ).toBeInTheDocument();
  });

  it("o dia lido compara com o gêmeo do período anterior", async () => {
    const user = userEvent.setup();
    render(<MetricCard {...props()} />);
    screen.getByRole("slider").focus();
    await user.keyboard("{Home}");
    // 14/11 = 9, gêmeo 07/11 = 4: +125%.
    expect(
      screen.getByRole("img", { name: deltaText(computeDelta(9, 4)) }),
    ).toBeInTheDocument();
  });

  it("movimento reduzido: trocar o turno em foco não agenda animação", async () => {
    mockReducedMotion(true);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const user = userEvent.setup();
    render(<MetricCard {...props()} />);
    await user.click(screen.getByRole("button", { name: "Mostrar só Manhã" }));
    expect(raf).not.toHaveBeenCalled();
  });

  it("com movimento normal, trocar o turno anima as linhas", async () => {
    mockReducedMotion(false);
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const user = userEvent.setup();
    render(<MetricCard {...props()} />);
    await user.click(screen.getByRole("button", { name: "Mostrar só Manhã" }));
    expect(raf).toHaveBeenCalled();
  });

  it("só português e só tokens: nada de texto em inglês nem de classe de cor crua", () => {
    const { container } = render(<MetricCard {...props()} />);
    expect(container.textContent).not.toMatch(
      /Revenue|vs previous|Show |previous period|Clear/,
    );
    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|stroke|fill|border|ring)-(?:zinc|emerald|rose|orange|slate|gray|white|black)\b/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("o resumo para leitor de tela traz total, média, passagens e variação", () => {
    render(<MetricCard {...props()} />);
    expect(
      screen.getByText(
        `Resumo do período: total de 70 peças; média por turno de 11,7; 6 passagens; ${deltaText(computeDelta(70, 50))}.`,
      ),
    ).toBeInTheDocument();
  });

  it("o turno em foco tem fundo bg-accent (o bg-muted é igual ao card e o destaque sumia)", async () => {
    const user = userEvent.setup();
    render(<MetricCard {...props()} />);
    await user.click(screen.getByRole("button", { name: "Mostrar só Manhã" }));
    const row = screen
      .getByRole("button", { name: "Mostrar todos os turnos" })
      .closest("li");
    expect(row).toHaveClass("bg-accent");
    expect(row).not.toHaveClass("bg-muted");
  });
});
