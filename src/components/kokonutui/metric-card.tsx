"use client";

/**
 * @author: @dorianbaffier
 * @description: Metric Card
 * @version: 2.0.0
 * @date: 2026-10-17
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adaptado ao Closery (Fase 5, D17): só tokens de cor, pt-BR, período por prop (sem pílulas),
 * série diária de 2N dias com os totais vindos do SQL (o cartão nunca soma), um segmento por turno
 * com link, escala rotulada a partir de 0, variação neutra e leitura de um dia por vez.
 */

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import Link from "next/link";
import {
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeDelta,
  type Delta,
  deltaAriaLabel,
  deltaText,
} from "@/features/dashboard/delta";
import { sharePercent } from "@/features/dashboard/format";
import { formatDateBR } from "@/features/handovers/saoPaulo";
import { formatDecimal, formatInteger } from "@/lib/numberFormat";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

export type MetricSegment = {
  key: string;
  label: string;
  swatchClass: string;
  strokeClass: string;
  total: number;
  previousTotal: number;
  href: string;
};

export type MetricPoint = {
  date: string;
  total: number;
  parts: readonly number[];
};

export type MetricCardProps = {
  label: string;
  unit: string;
  context?: string | null;
  periodDays: number;
  total: number;
  average: number | null;
  handoverCount: number;
  delta: Delta;
  segments: readonly MetricSegment[];
  series: readonly MetricPoint[];
  href: string;
  className?: string;
};

// A caixa do gráfico: estica até a largura do cartão. O PAD_Y deixa espaço para os rótulos da escala.
const W = 400;
const H = 120;
const PAD_Y = 18;
// Todo período é reamostrado neste número de pontos, para uma forma virar a outra.
const SAMPLES = 90;
const MORPH_MS = 420;
const DIGIT = /\d/;
const SNAP_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

type Shape = { current: number[]; previous: number[] };
type Paths = { current: string; previous: string };

const clamp = (value: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, value));

/** dd/mm, a partir do texto ISO (nunca passa por Date). */
const shortDate = (isoDate: string) => formatDateBR(isoDate).slice(0, 5);

/** O valor desenhado de um dia: o total do SQL ou a parte do turno em foco. Nada é somado aqui. */
function pointValue(point: MetricPoint, focus: number | null): number {
  return focus === null ? point.total : (point.parts[focus] ?? 0);
}

/** Reamostra `values` em `count` pontos igualmente espaçados. */
function resample(values: readonly number[], count: number): number[] {
  if (values.length === 0) {
    return new Array<number>(count).fill(0);
  }
  return Array.from({ length: count }, (_, i) => {
    const at = (i / (count - 1)) * (values.length - 1);
    const lo = Math.floor(at);
    const hi = Math.min(values.length - 1, lo + 1);
    return values[lo] + (values[hi] - values[lo]) * (at - lo);
  });
}

const yOf = (height: number) => PAD_Y + (1 - height) * (H - PAD_Y * 2);

/** Alturas de 0 a 1 viram um caminho SVG, suavizado com spline de Catmull-Rom. */
function toPath(heights: readonly number[]): string {
  if (heights.length === 0) {
    return "";
  }
  const points = heights.map(
    (height, i) =>
      [(i / Math.max(1, heights.length - 1)) * W, yOf(height)] as const,
  );
  const curves = points.slice(0, -1).map((p1, i) => {
    const p0 = points[i - 1] ?? p1;
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    return `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  });
  return `M${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}${curves.join("")}`;
}

/** A linha fechada até a base. */
const toArea = (line: string) => `${line}L${W} ${H}L0 ${H}Z`;

/**
 * Os números e a forma de um período, do total ou de um turno. A escala vai de 0 ao maior valor
 * desenhado (Math.max escolhe, não soma).
 */
function buildPeriod(
  series: readonly MetricPoint[],
  days: number,
  focus: number | null,
) {
  const current = series.slice(-days);
  const previous = series.slice(-days * 2, -days);
  const now = current.map((point) => pointValue(point, focus));
  const before = previous.map((point) => pointValue(point, focus));
  const max = Math.max(0, ...now, ...before);
  const norm = (value: number) => (max > 0 ? value / max : 0);
  return {
    current,
    previous,
    now,
    before,
    max,
    norm,
    shape: {
      current: resample(now.map(norm), SAMPLES),
      previous: resample(before.map(norm), SAMPLES),
    } satisfies Shape,
    paths: {
      current: toPath(now.map(norm)),
      previous: toPath(before.map(norm)),
    } satisfies Paths,
  };
}

type Period = ReturnType<typeof buildPeriod>;

/** O dia lido (e o dia gêmeo do período anterior), ou null quando nada está sendo lido. */
function readDay(info: Period, index: number | null) {
  if (index === null) {
    return null;
  }
  const day = info.current[index];
  const value = info.now[index];
  if (day === undefined || value === undefined) {
    return null;
  }
  return {
    day,
    value,
    twin: info.previous[index],
    twinValue: info.before[index],
  };
}

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

/** Cada dígito rola na própria roda; os separadores ficam parados. */
function RollingNumber({ value }: { value: string }) {
  const chars = value.split("");
  return (
    <span aria-hidden className="inline-flex tabular-nums">
      {chars.map((char, i) => {
        // A chave conta da direita, para a unidade não pular quando o tamanho muda.
        const key = chars.length - i;
        if (!DIGIT.test(char)) {
          return <span key={`s${key}`}>{char}</span>;
        }
        return (
          <span
            className="relative inline-block h-[1em] overflow-hidden leading-none"
            key={`d${key}`}
          >
            <span className="invisible">0</span>
            <span
              className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-[380ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${Number(char) * 10}%)` }}
            >
              {SNAP_DIGITS.map((digit) => (
                <span className="block h-[1em] leading-none" key={digit}>
                  {digit}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** A variação é neutra (sem verde nem vermelho): o ícone e o texto dizem o que houve. */
function DeltaBadge({ delta }: { delta: Delta }) {
  const Icon =
    delta.kind === "up" ? ArrowUp : delta.kind === "down" ? ArrowDown : Minus;
  return (
    <span
      aria-label={deltaAriaLabel(delta)}
      className="inline-flex shrink-0 items-center gap-1 font-medium text-muted-foreground"
      role="img"
    >
      <Icon aria-hidden className="size-3.5" />
      {deltaText(delta)}
    </span>
  );
}

/** As setas leem um dia por vez. Home e End vão para o primeiro e o último. */
function keyTarget(key: string, from: number, last: number): number | null {
  switch (key) {
    case "ArrowLeft":
      return clamp(from - 1, 0, last);
    case "ArrowRight":
      return clamp(from + 1, 0, last);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

const CARD =
  "w-full max-w-md select-none rounded-3xl border border-border bg-card p-5 text-card-foreground";

const LINK_FOCUS =
  "rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function MetricCard(props: MetricCardProps) {
  const { label, unit, context, className, handoverCount } = props;
  // Sem nenhuma passagem com o item não há linha para desenhar: o cartão ensina em vez de mostrar 0.
  if (handoverCount === 0) {
    return (
      <div className={cn(CARD, className)}>
        <p className="truncate text-muted-foreground text-sm">{label}</p>
        {context ? (
          <p className="truncate text-muted-foreground text-xs">{context}</p>
        ) : null}
        <p className="mt-3 font-semibold text-xl tracking-tight">
          Sem passagens no período
        </p>
        <p className="mt-1 text-muted-foreground text-xs">{unit}</p>
      </div>
    );
  }
  // O período muda de forma: a chave zera o dia lido e o turno em foco.
  return <MetricCardBody key={props.periodDays} {...props} />;
}

function MetricCardBody({
  label,
  unit,
  context,
  periodDays,
  total,
  average,
  handoverCount,
  delta,
  segments,
  series,
  href,
  className,
}: MetricCardProps) {
  const clipId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-lit`;
  // O turno em foco (índice em `segments`) e o dia sob o ponteiro ou o teclado.
  const [focus, setFocus] = useState<number | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const info = useMemo(
    () => buildPeriod(series, periodDays, focus),
    [series, periodDays, focus],
  );

  const currentRef = useRef<SVGPathElement>(null);
  const currentDimRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const previousRef = useRef<SVGPathElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const shown = useRef<Shape>(info.shape);
  const morph = useRef({ raf: 0 });

  // Um turno novo em foco faz as linhas escorregarem de onde estão para a forma nova.
  useEffect(() => {
    const from = shown.current;
    const to = info.shape;
    const m = morph.current;
    cancelAnimationFrame(m.raf);
    const paint = (paths: Paths) => {
      currentRef.current?.setAttribute("d", paths.current);
      currentDimRef.current?.setAttribute("d", paths.current);
      areaRef.current?.setAttribute("d", toArea(paths.current));
      previousRef.current?.setAttribute("d", paths.previous);
    };
    const land = () => {
      shown.current = to;
      paint(info.paths);
    };
    if (
      from === to ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      land();
      return;
    }
    const start = performance.now();
    const frame = (now: number) => {
      const t = easeInOut(Math.min(1, (now - start) / MORPH_MS));
      const mix = (a: number[], b: number[]) =>
        a.map((v, i) => v + (b[i] - v) * t);
      shown.current = {
        current: mix(from.current, to.current),
        previous: mix(from.previous, to.previous),
      };
      if (t < 1) {
        paint({
          current: toPath(shown.current.current),
          previous: toPath(shown.current.previous),
        });
        m.raf = requestAnimationFrame(frame);
      } else {
        land();
      }
    };
    m.raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(m.raf);
  }, [info.shape, info.paths]);

  const last = info.current.length - 1;

  const indexAt = (clientX: number) => {
    const rect = chartRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) {
      return last;
    }
    const t = clamp((clientX - rect.left) / rect.width, 0, 1);
    return Math.round(t * last);
  };

  // O mouse lê ao passar; o toque lê enquanto o dedo está na tela.
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    setCursor(indexAt(event.clientX));
  };
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      setCursor(indexAt(event.clientX));
    }
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      setCursor(null);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setCursor(null);
      return;
    }
    const target = keyTarget(event.key, cursor ?? last, last);
    if (target === null) {
      return;
    }
    event.preventDefault();
    setCursor(target);
  };

  // O que o cartão lê: um dia, o turno em foco ou o período inteiro. Os números vêm prontos do
  // servidor (total, previousTotal, parts, total do dia); nenhuma soma acontece aqui.
  const focusSegment = focus === null ? undefined : segments[focus];
  const read = readDay(info, cursor);
  const shownValue = read
    ? read.value
    : focusSegment
      ? focusSegment.total
      : total;
  let shownDelta: Delta = delta;
  if (read) {
    shownDelta =
      read.twinValue === undefined
        ? { kind: "none" }
        : computeDelta(read.value, read.twinValue);
  } else if (focusSegment) {
    shownDelta = computeDelta(focusSegment.total, focusSegment.previousTotal);
  }
  const numberHref = focusSegment ? focusSegment.href : href;

  const formatted = formatInteger(shownValue);
  const withUnit = `${formatted} ${unit}`;
  const valueText = read
    ? `${formatDateBR(read.day.date)}: ${withUnit}`
    : `${withUnit} no período`;
  const linesClass = focusSegment
    ? focusSegment.strokeClass
    : "stroke-foreground";

  const xOf = (i: number) => (last > 0 ? (i / last) * W : W);
  const pct = (i: number) => (xOf(i) / W) * 100;
  // A parte acesa da linha vai até o dia lido; sem leitura, vai até o fim.
  const litTo = cursor === null || !read ? W : xOf(cursor);
  const endValue = info.now.at(-1) ?? 0;
  const endY = yOf(info.norm(endValue));
  const firstDay = info.current[0];
  const lastDay = info.current.at(-1);

  return (
    <div className={cn(CARD, className)}>
      <p className="truncate text-muted-foreground text-sm">
        {label}
        {focusSegment ? (
          <span className="text-card-foreground"> · {focusSegment.label}</span>
        ) : null}
      </p>
      {context ? (
        <p className="truncate text-muted-foreground text-xs">{context}</p>
      ) : null}

      <p className="mt-3 font-semibold text-4xl tracking-tight">
        {read ? (
          <span>
            <span className="sr-only">{withUnit}</span>
            <RollingNumber value={formatted} />
            <span className="ml-2 font-normal text-base text-muted-foreground">
              {unit}
            </span>
          </span>
        ) : (
          <Link
            aria-label={
              focusSegment
                ? `${withUnit} em ${focusSegment.label}: ver as passagens`
                : `${withUnit}: ver as passagens do período`
            }
            className={cn(LINK_FOCUS, "hover:underline")}
            href={numberHref}
          >
            <RollingNumber value={formatted} />
            <span className="ml-2 font-normal text-base text-muted-foreground">
              {unit}
            </span>
          </Link>
        )}
      </p>
      <p className="mt-1 text-muted-foreground text-sm tabular-nums">
        {average === null
          ? null
          : `média de ${formatDecimal(average)} por turno · `}
        <Link
          className={cn(
            LINK_FOCUS,
            "inline-flex items-center underline-offset-2 hover:underline max-md:min-h-11",
          )}
          href={href}
        >
          {pluralize(handoverCount, "passagem", "passagens")}
        </Link>
      </p>
      <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-2 text-sm tabular-nums">
        <DeltaBadge delta={shownDelta} />
        {read ? (
          <span className="truncate text-muted-foreground">
            {formatDateBR(read.day.date)} vs{" "}
            {read.twin ? formatDateBR(read.twin.date) : "—"}
          </span>
        ) : null}
        {cursor === null ? null : (
          <button
            className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-muted-foreground text-xs outline-none transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
            onClick={() => setCursor(null)}
            type="button"
          >
            Voltar ao período
          </button>
        )}
      </div>

      <div
        aria-label={`${label} por dia, ${periodDays} dias. Use as setas para ler cada dia.`}
        aria-valuemax={info.current.length}
        aria-valuemin={1}
        aria-valuenow={
          read && cursor !== null ? cursor + 1 : info.current.length
        }
        aria-valuetext={valueText}
        className="relative mt-5 h-32 cursor-crosshair touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
        onKeyDown={handleKeyDown}
        onPointerCancel={release}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => setCursor(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        ref={chartRef}
        role="slider"
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${W} ${H}`}
        >
          <defs>
            <clipPath id={clipId}>
              <rect height={H + 20} width={litTo} x={0} y={-10} />
            </clipPath>
          </defs>
          <line
            className="stroke-border"
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
            x1={0}
            x2={W}
            y1={yOf(1)}
            y2={yOf(1)}
          />
          <line
            className="stroke-border"
            vectorEffect="non-scaling-stroke"
            x1={0}
            x2={W}
            y1={yOf(0)}
            y2={yOf(0)}
          />
          <path
            className="fill-none stroke-muted-foreground/50"
            d={info.paths.previous}
            ref={previousRef}
            strokeDasharray="3 4"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
          {/* A área só preenche a parte lida. */}
          <path
            className="fill-foreground/5"
            clipPath={`url(#${clipId})`}
            d={toArea(info.paths.current)}
            ref={areaRef}
          />
          <path
            className={cn("fill-none opacity-25", linesClass)}
            d={info.paths.current}
            ref={currentDimRef}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className={cn("fill-none", linesClass)}
            clipPath={`url(#${clipId})`}
            d={info.paths.current}
            ref={currentRef}
            strokeLinecap="round"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* A escala: 0 na base e o maior valor desenhado no topo, com a unidade. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 text-muted-foreground text-xs tabular-nums"
          style={{ bottom: `${100 - (yOf(1) / H) * 100}%` }}
        >
          {formatInteger(info.max)} {unit}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 text-muted-foreground text-xs tabular-nums"
          style={{ top: `${(yOf(0) / H) * 100}%` }}
        >
          0
        </span>

        {read && cursor !== null ? (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-border"
              style={{ left: `${pct(cursor)}%` }}
            />
            {read.twinValue === undefined ? null : (
              <div
                aria-hidden
                className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-muted-foreground bg-card"
                style={{
                  left: `${pct(cursor)}%`,
                  top: `${(yOf(info.norm(read.twinValue)) / H) * 100}%`,
                }}
              />
            )}
            <div
              aria-hidden
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-4 ring-card"
              style={{
                left: `${pct(cursor)}%`,
                top: `${(yOf(info.norm(read.value)) / H) * 100}%`,
              }}
            />
          </>
        ) : null}

        {/* Hoje, em repouso. Acompanha o movimento até o novo fim. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute right-0 size-2 translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-4 ring-card transition-[top,opacity] duration-[420ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
            read ? "opacity-0" : "opacity-100",
          )}
          style={{ top: `${(endY / H) * 100}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-muted-foreground text-xs tabular-nums">
        <span>{firstDay ? shortDate(firstDay.date) : ""}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={cn(
                "h-0.5 w-3 rounded-full",
                focusSegment ? focusSegment.swatchClass : "bg-foreground",
              )}
            />
            Período atual
          </span>
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-px w-3 border-muted-foreground/50 border-t border-dashed"
            />
            Período anterior
          </span>
        </span>
        <span>{lastDay ? shortDate(lastDay.date) : ""}</span>
      </div>

      <p className="sr-only">
        {`Resumo do período: total de ${formatInteger(total)} ${unit}; ${
          average === null
            ? "sem média por turno"
            : `média por turno de ${formatDecimal(average)}`
        }; ${pluralize(handoverCount, "passagem", "passagens")}; ${deltaText(delta)}.`}
      </p>

      {segments.length >= 2 ? (
        <div className="mt-4 border-border border-t pt-4">
          <p className="font-medium text-sm">Por turno</p>
          <div aria-hidden className="mt-2 flex h-1.5 gap-0.5">
            {segments.map((segment, i) => (
              <span
                className={cn(
                  "min-w-0 rounded-full transition-[flex-grow,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                  segment.swatchClass,
                )}
                key={segment.key}
                style={{
                  flexGrow: segment.total,
                  opacity: focus !== null && focus !== i ? 0.25 : 1,
                }}
              />
            ))}
          </div>
          <ul className="mt-2.5">
            {segments.map((segment, i) => (
              <li
                className={cn(
                  "flex items-center rounded-lg transition-[background-color,opacity] duration-150 ease-out motion-reduce:transition-none",
                  focus === i && "bg-muted",
                  focus !== null && focus !== i && "opacity-50",
                )}
                key={segment.key}
              >
                <button
                  aria-label={
                    focus === i
                      ? "Mostrar todos os turnos"
                      : `Mostrar só ${segment.label}`
                  }
                  aria-pressed={focus === i}
                  className="flex min-h-9 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 text-left text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
                  onClick={() => setFocus((f) => (f === i ? null : i))}
                  type="button"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      segment.swatchClass,
                    )}
                  />
                  <span className="flex-1 truncate text-card-foreground">
                    {segment.label}
                  </span>
                  <span className="w-10 text-right text-muted-foreground tabular-nums">
                    {sharePercent(segment.total, total)}%
                  </span>
                </button>
                <Link
                  aria-label={`${formatInteger(segment.total)} ${unit} em ${segment.label}: ver as passagens`}
                  className={cn(
                    LINK_FOCUS,
                    "flex min-h-9 min-w-12 items-center justify-end px-2 font-medium text-sm tabular-nums hover:underline max-md:min-h-11",
                  )}
                  href={segment.href}
                >
                  {formatInteger(segment.total)}
                </Link>
              </li>
            ))}
          </ul>
          <output className="sr-only">
            {focusSegment
              ? `Mostrando só ${focusSegment.label}: ${formatInteger(focusSegment.total)} ${unit}`
              : "Mostrando todos os turnos"}
          </output>
        </div>
      ) : null}
    </div>
  );
}
