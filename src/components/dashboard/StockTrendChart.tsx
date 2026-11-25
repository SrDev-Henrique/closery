"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { StockPoint } from "@/features/dashboard/types";
import { formatDateBR } from "@/features/handovers/saoPaulo";
import { formatInteger } from "@/lib/numberFormat";

import { SINGLE_SERIES_COLOR } from "./chartColors";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type StockTrendChartProps = {
  label: string;
  unit: string;
  points: readonly StockPoint[];
};

/** dd/mm, a partir do texto ISO (nunca passa por Date). */
const shortDate = (isoDate: string) => formatDateBR(isoDate).slice(0, 5);

/**
 * A evolução da contagem de um item: um ponto por dia (dia sem contagem = vazio, a linha liga os
 * pontos). Os números chegam prontos do servidor. A tabela `sr-only` traz o valor exato de cada dia.
 */
export function StockTrendChart({ label, unit, points }: StockTrendChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const config = {
    quantity: { label: unit, color: SINGLE_SERIES_COLOR },
  } satisfies ChartConfig;

  if (points.every((point) => point.quantity === null)) {
    return (
      <p className="text-muted-foreground text-sm">Sem contagem no período.</p>
    );
  }

  return (
    <div>
      <ChartContainer className="aspect-auto h-48 w-full" config={config}>
        <LineChart
          accessibilityLayer
          data={points.map((point) => ({
            date: point.date,
            quantity: point.quantity,
          }))}
          margin={{ left: 4, right: 12, top: 8 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="date"
            interval="preserveStartEnd"
            tickFormatter={(value: string) => shortDate(value)}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickFormatter={(value: number) => formatInteger(value)}
            tickLine={false}
            width={44}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value) => (
                  <span className="font-medium tabular-nums">
                    {typeof value === "number"
                      ? `${formatInteger(value)} ${unit}`
                      : "sem contagem"}
                  </span>
                )}
                hideIndicator
                labelFormatter={(value) =>
                  typeof value === "string" ? formatDateBR(value) : value
                }
              />
            }
          />
          <Line
            connectNulls
            dataKey="quantity"
            dot={{ r: 3, fill: "var(--color-quantity)" }}
            isAnimationActive={!reducedMotion}
            stroke="var(--color-quantity)"
            strokeWidth={2}
            type="monotone"
          />
        </LineChart>
      </ChartContainer>
      <table className="sr-only">
        <caption>{label} por dia</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Contagem ({unit})</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date}>
              <th scope="row">{formatDateBR(point.date)}</th>
              <td>
                {point.quantity === null
                  ? "sem contagem"
                  : formatInteger(point.quantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
