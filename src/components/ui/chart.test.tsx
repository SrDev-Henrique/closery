import { render, screen } from "@testing-library/react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const CONFIG = {
  quantity: { label: "peças", color: "var(--chart-1)" },
} satisfies ChartConfig;

const DATA = [
  { day: "20/11", quantity: 1234 },
  { day: "21/11", quantity: 5 },
];

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error");
  warnSpy = vi.spyOn(console, "warn");
});
afterEach(() => {
  expect(errorSpy).not.toHaveBeenCalled();
  expect(warnSpy).not.toHaveBeenCalled();
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("ChartContainer (recharts 3.8, sem ResizeObserver)", () => {
  it("renderiza o gráfico e injeta a cor do ChartConfig nos dois temas", () => {
    const { container } = render(
      <ChartContainer className="aspect-auto h-60 w-full" config={CONFIG}>
        <LineChart accessibilityLayer data={DATA}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            dataKey="quantity"
            isAnimationActive={false}
            stroke="var(--color-quantity)"
            type="monotone"
          />
        </LineChart>
      </ChartContainer>,
    );
    const style = container.querySelector("style")?.textContent ?? "";
    expect(style).toContain("--color-quantity: var(--chart-1)");
    expect(style).toContain(".dark [data-chart=");
    expect(container.querySelector("[data-slot=chart]")).not.toBeNull();
    expect(container.querySelector("path.recharts-line-curve")).not.toBeNull();
  });

  it("o tooltip formata o número em pt-BR e usa tabular-nums, sem font-mono", () => {
    const { container } = render(
      <ChartContainer className="aspect-auto h-60 w-full" config={CONFIG}>
        <LineChart data={DATA}>
          <XAxis dataKey="day" />
          <ChartTooltip
            content={<ChartTooltipContent />}
            defaultIndex={0}
            active
          />
          <Line
            dataKey="quantity"
            isAnimationActive={false}
            stroke="var(--color-quantity)"
          />
        </LineChart>
      </ChartContainer>,
    );
    const value = screen.getByText("1.234");
    expect(value.className).toContain("tabular-nums");
    expect(value.className).not.toContain("font-mono");
    expect(container.innerHTML).not.toContain("font-mono");
  });

  it("sem dado nenhum não quebra", () => {
    const { container } = render(
      <ChartContainer className="aspect-auto h-60 w-full" config={CONFIG}>
        <LineChart data={[]}>
          <XAxis dataKey="day" />
          <Line dataKey="quantity" isAnimationActive={false} />
        </LineChart>
      </ChartContainer>,
    );
    expect(container.querySelector("[data-slot=chart]")).not.toBeNull();
  });
});
