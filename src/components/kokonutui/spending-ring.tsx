"use client";

/**
 * @author: @dorianbaffier
 * @description: Spending Ring
 * @version: 1.0.0
 * @date: 2026-10-15
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 *
 * Adaptado ao Closery (Fase 5, D17): só tokens de cor, pt-BR, sem moeda, o total vem do SQL (o anel
 * nunca soma as fatias), a legenda é uma lista de links (todas as fatias, inclusive as zeradas) e
 * o React Compiler compila o componente (a versão crua o fazia desistir em silêncio).
 */

import Link from "next/link";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { sharePercent } from "@/features/dashboard/format";
import { formatInteger } from "@/lib/numberFormat";
import { cn } from "@/lib/utils";

export type RingSlice = {
  key: string;
  label: string;
  value: number;
  href: string;
  strokeClass: string;
  dotClass: string;
  icon?: ReactNode;
};

export type SpendingRingProps = {
  title: string;
  legendLabel: string;
  total: number;
  /** A lista que o total conta: o total também é um link. */
  totalHref: string;
  slices: readonly RingSlice[];
  emptyText: string;
  className?: string;
};

type RingSpan = { index: number; from: number; to: number };

const TOTAL_LINK =
  "rounded-sm font-medium text-sm tabular-nums outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:min-w-11 max-md:justify-end";

const SIZE = 240;
const C = SIZE / 2;
const R = 90;
const STROKE = 22;
// Graus deixados vazios entre as fatias e o mínimo de uma fatia com valor (nunca arco invertido).
const GAP = 2.4;
const MIN_SWEEP = 3;
// Mola do ângulo do anel: taxa em rad/s e amortecimento. Um pouco abaixo do crítico, para o
// giro assentar na fatia com uma pequena folga.
const RATE = 11;
const DAMPING = 0.78;
// Quanto à frente um arremesso é projetado ao escolher onde pousa, em segundos.
const PROJECT = 0.2;
// Movimento abaixo disto, em pixels, é um toque, não um giro.
const TAP_SLOP = 5;

/**
 * Onde cada fatia com valor começa e termina, em graus a partir do topo, no sentido horário.
 * Fatias zeradas não desenham; uma fatia pequena nunca fica abaixo de `minSweepDegrees` e a soma
 * dos arcos é sempre 360 − (fatias × vão). Sem `let` reatribuído: o React Compiler não aceita.
 */
export function ringSpans(
  values: readonly number[],
  total: number,
  gapDegrees: number,
  minSweepDegrees: number,
): RingSpan[] {
  const active = values
    .map((value, index) => ({ value, index }))
    .filter(({ value }) => value > 0);
  if (active.length === 0 || total <= 0) {
    return [];
  }
  const usable = 360 - active.length * gapDegrees;
  const raw = active.map(({ value }) => (value / total) * usable);
  const small = raw.filter((sweep) => sweep < minSweepDegrees).length;
  const bigSum = raw
    .filter((sweep) => sweep >= minSweepDegrees)
    .reduce((acc, sweep) => acc + sweep, 0);
  const scale = bigSum > 0 ? (usable - small * minSweepDegrees) / bigSum : 0;
  const sweeps = raw.map((sweep) => {
    if (bigSum === 0) {
      return usable / active.length;
    }
    return sweep < minSweepDegrees ? minSweepDegrees : sweep * scale;
  });
  return active.reduce<RingSpan[]>((acc, { index }, i) => {
    const from = (acc.at(-1)?.to ?? -gapDegrees / 2) + gapDegrees;
    acc.push({ index, from, to: from + sweeps[i] });
    return acc;
  }, []);
}

const midOf = (span: RingSpan) => (span.from + span.to) / 2;

/** Dá a volta no ângulo para -180..180. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

/** Um ponto no anel, com 0° no topo e os ângulos crescendo no sentido horário. */
function polar(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)] as const;
}

function arc(from: number, to: number) {
  const [x0, y0] = polar(from);
  const [x1, y1] = polar(to);
  const large = to - from > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** A fatia mais próxima de um ângulo do anel (o vão entre fatias cai na vizinha). */
function sliceAt(spans: readonly RingSpan[], deg: number) {
  const angle = ((deg % 360) + 360) % 360;
  return spans.reduce(
    (best, span, i) => {
      const distance = Math.abs(wrap(angle - midOf(span)));
      return distance < best.distance ? { index: i, distance } : best;
    },
    { index: 0, distance: Number.POSITIVE_INFINITY },
  ).index;
}

/** Um passo de uma mola amortecida, em fatias pequenas para ficar estável. */
function springStep(
  state: { a: number; v: number },
  target: number,
  dt: number,
) {
  const slices = Math.ceil(dt / (1 / 240));
  const h = dt / slices;
  for (let i = 0; i < slices; i++) {
    const accel =
      -RATE * RATE * (state.a - target) - 2 * DAMPING * RATE * state.v;
    state.v += accel * h;
    state.a += state.v * h;
  }
  return Math.abs(state.a - target) < 0.05 && Math.abs(state.v) < 2;
}

const CARD =
  "w-full max-w-sm rounded-3xl border border-border bg-card p-5 text-card-foreground";

const ROW =
  "flex min-h-9 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none max-md:min-h-11";

/** A legenda: um link por fatia (todas, inclusive as zeradas), com o número exato. */
function RingLegend({
  legendLabel,
  slices,
  total,
  selectedIndex,
  onSelect,
}: {
  legendLabel: string;
  slices: readonly RingSlice[];
  total: number;
  selectedIndex: number | null;
  onSelect?: (index: number) => void;
}) {
  return (
    <ul aria-label={legendLabel} className="mt-4 grid grid-cols-1 gap-1">
      {slices.map((slice, i) => {
        const percent = sharePercent(slice.value, total);
        return (
          <li key={slice.key}>
            <Link
              aria-label={`${slice.label}: ${formatInteger(slice.value)} (${percent}%)`}
              className={cn(
                ROW,
                i === selectedIndex
                  ? "bg-muted"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              href={slice.href}
              onFocus={() => onSelect?.(i)}
              onMouseEnter={() => onSelect?.(i)}
            >
              <span
                aria-hidden="true"
                className={cn("size-2 shrink-0 rounded-full", slice.dotClass)}
              />
              {slice.icon}
              <span className="min-w-0 flex-1 truncate">{slice.label}</span>
              <span className="font-medium tabular-nums">
                {formatInteger(slice.value)}
              </span>
              <span className="w-10 text-right tabular-nums">{percent}%</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Sem total (ou sem nenhuma fatia com valor) não há arco para desenhar. */
export function SpendingRing(props: SpendingRingProps) {
  const { title, legendLabel, total, totalHref, slices, emptyText, className } =
    props;
  if (total <= 0 || slices.every((slice) => slice.value <= 0)) {
    return (
      <div className={cn(CARD, className)}>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-muted-foreground text-sm">{title}</p>
          <Link
            aria-label="0 passagens: ver a lista"
            className={TOTAL_LINK}
            href={totalHref}
          >
            0
          </Link>
        </div>
        <p className="mt-3 text-muted-foreground text-sm">{emptyText}</p>
        <RingLegend
          legendLabel={legendLabel}
          selectedIndex={null}
          slices={slices}
          total={total}
        />
      </div>
    );
  }
  return <SpendingRingBody {...props} />;
}

function SpendingRingBody({
  title,
  legendLabel,
  total,
  totalHref,
  slices,
  className,
}: SpendingRingProps) {
  // Só o que tem valor vira arco; a legenda continua listando todas as fatias.
  const spans = useMemo(
    () =>
      ringSpans(
        slices.map((slice) => slice.value),
        total,
        GAP,
        MIN_SWEEP,
      ),
    [slices, total],
  );
  const [selected, setSelected] = useState(0);
  const [dragging, setDragging] = useState(false);
  const ringRef = useRef<SVGGElement>(null);
  const selectedRef = useRef(0);

  // O anel gira para a fatia escolhida ficar sob o marcador, no topo.
  const sim = useRef({
    a: -(spans[0] ? midOf(spans[0]) : 0),
    v: 0,
    target: -(spans[0] ? midOf(spans[0]) : 0),
    raf: 0,
    last: 0,
    // Enquanto um arremesso desliza, a leitura acompanha o que passa pelo marcador.
    coast: false,
    drag: null as null | {
      id: number;
      angle: number;
      time: number;
      moved: number;
      x: number;
      y: number;
    },
  });

  const paint = useCallback(() => {
    ringRef.current?.setAttribute(
      "transform",
      `rotate(${sim.current.a.toFixed(3)} ${C} ${C})`,
    );
  }, []);

  /** Mostra a fatia que está sob o marcador agora. */
  const track = useCallback(() => {
    const index = sliceAt(spans, -sim.current.a);
    if (index !== selectedRef.current) {
      selectedRef.current = index;
      setSelected(index);
    }
  }, [spans]);

  // `requestAnimationFrame(tick)` dentro do próprio useCallback faz o React Compiler desistir do
  // componente: o `tick` se reagenda por uma ref.
  const tickRef = useRef<((now: number) => void) | null>(null);
  const tick = useCallback(
    (now: number) => {
      const s = sim.current;
      s.raf = 0;
      if (s.drag) {
        return;
      }
      const dt = s.last ? Math.min((now - s.last) / 1000, 1 / 30) : 1 / 60;
      s.last = now;
      const state = { a: s.a, v: s.v };
      const settled = springStep(state, s.target, dt);
      s.a = settled ? s.target : state.a;
      s.v = settled ? 0 : state.v;
      paint();
      if (s.coast) {
        track();
      }
      if (settled) {
        s.last = 0;
        s.coast = false;
      } else {
        s.raf = requestAnimationFrame((t) => tickRef.current?.(t));
      }
    },
    [paint, track],
  );
  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  /**
   * Gira o anel até uma fatia, pelo caminho curto a partir de onde ele pararia sozinho (um
   * arremesso segue para o lado em que foi jogado). O padrão `restAt` é resolvido no corpo: um
   * parâmetro padrão que lê ref faz o React Compiler desistir.
   */
  const turnTo = useCallback(
    (index: number, restAt?: number, coast = false) => {
      const s = sim.current;
      const rest = restAt ?? s.a;
      const span = spans[index];
      const goal = -(span ? midOf(span) : 0);
      s.target = rest + wrap(goal - rest);
      s.coast = coast;
      if (!coast) {
        selectedRef.current = index;
        setSelected(index);
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        s.a = s.target;
        s.v = 0;
        s.coast = false;
        paint();
        track();
        return;
      }
      if (!s.raf) {
        s.last = 0;
        s.raf = requestAnimationFrame(tick);
      }
    },
    [paint, spans, tick, track],
  );

  // Dado novo mantém a mesma fatia sob o marcador. Um render com os mesmos números num array novo
  // não atrapalha um giro em andamento.
  useEffect(() => {
    const s = sim.current;
    const index = Math.max(0, Math.min(selectedRef.current, spans.length - 1));
    const span = spans[index];
    const goal = -(span ? midOf(span) : 0);
    if (Math.abs(wrap(goal - s.target)) < 0.001) {
      return;
    }
    s.a = goal;
    s.target = goal;
    s.v = 0;
    selectedRef.current = index;
    setSelected(index);
    paint();
  }, [spans, paint]);

  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);

  const pointerAngle = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = event.clientY - rect.top - rect.height / 2;
    return (Math.atan2(x, -y) * 180) / Math.PI;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    if (s.drag || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    cancelAnimationFrame(s.raf);
    s.raf = 0;
    s.v = 0;
    s.drag = {
      id: event.pointerId,
      angle: pointerAngle(event),
      time: event.timeStamp,
      moved: 0,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    const drag = s.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    drag.moved = Math.max(
      drag.moved,
      Math.hypot(event.clientX - drag.x, event.clientY - drag.y),
    );
    if (drag.moved < TAP_SLOP) {
      return;
    }
    const angle = pointerAngle(event);
    const delta = wrap(angle - drag.angle);
    const dt = Math.max((event.timeStamp - drag.time) / 1000, 1 / 240);
    s.a += delta;
    // Velocidade angular suavizada, para o arremesso ao soltar.
    s.v = s.v * 0.6 + (delta / dt) * 0.4;
    drag.angle = angle;
    drag.time = event.timeStamp;
    setDragging(true);
    paint();
    track();
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    const s = sim.current;
    const drag = s.drag;
    if (!drag || drag.id !== event.pointerId) {
      return;
    }
    s.drag = null;
    setDragging(false);
    if (drag.moved < TAP_SLOP) {
      // Um toque no anel escolhe a fatia sob o dedo; o miolo é só leitura.
      const rect = event.currentTarget.getBoundingClientRect();
      const r = Math.hypot(
        event.clientX - rect.left - rect.width / 2,
        event.clientY - rect.top - rect.height / 2,
      );
      if (r > ((R - STROKE) / SIZE) * rect.width) {
        turnTo(sliceAt(spans, pointerAngle(event) - s.a));
      }
      return;
    }
    // Um giro parado antes de soltar não tem arremesso.
    if (event.timeStamp - drag.time > 80) {
      s.v = 0;
    }
    s.v = Math.max(-1440, Math.min(1440, s.v));
    const rest = s.a + s.v * PROJECT;
    turnTo(sliceAt(spans, -rest), rest, true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };
    let next: number | null = null;
    if (event.key in step) {
      next = (selected + step[event.key] + spans.length) % spans.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = spans.length - 1;
    }
    if (next !== null) {
      event.preventDefault();
      turnTo(next);
    }
  };

  /** Foco ou passagem do mouse numa linha da legenda gira o anel até a fatia dela. */
  const selectSlice = (sliceIndex: number) => {
    const position = spans.findIndex((span) => span.index === sliceIndex);
    if (position !== -1 && position !== selectedRef.current) {
      turnTo(position);
    }
  };

  const currentSpan = spans[selected];
  const current = currentSpan ? slices[currentSpan.index] : undefined;
  const share = current ? sharePercent(current.value, total) : 0;
  const selectedSliceIndex = currentSpan ? currentSpan.index : null;

  return (
    <div className={cn(CARD, className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-muted-foreground text-sm">{title}</p>
        <Link
          aria-label={`${formatInteger(total)} passagens: ver a lista`}
          className={TOTAL_LINK}
          href={totalHref}
        >
          {formatInteger(total)}
        </Link>
      </div>

      <div
        aria-label={`${title}. Use as setas para girar o anel.`}
        aria-valuemax={spans.length}
        aria-valuemin={1}
        aria-valuenow={selected + 1}
        aria-valuetext={
          current
            ? `${current.label}: ${formatInteger(current.value)} (${share}%)`
            : ""
        }
        className={cn(
          "relative mx-auto mt-3 aspect-square w-full max-w-[240px] touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onKeyDown={handleKeyDown}
        onLostPointerCapture={release}
        onPointerCancel={release}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        role="slider"
        tabIndex={0}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <g
            ref={ringRef}
            transform={`rotate(${-(spans[0] ? midOf(spans[0]) : 0)} ${C} ${C})`}
          >
            {spans.map((span, i) => {
              const slice = slices[span.index];
              return (
                <path
                  className={cn(
                    "transition-[stroke-width,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none",
                    slice.strokeClass,
                    i !== selected && "opacity-40 dark:opacity-50",
                  )}
                  d={arc(span.from, span.to)}
                  fill="none"
                  key={slice.key}
                  strokeWidth={i === selected ? STROKE + 8 : STROKE}
                />
              );
            })}
          </g>
          {/* O marcador para onde o anel gira as fatias. */}
          <path
            className="fill-foreground"
            d={`M${C - 5} 2 L${C + 5} 2 L${C} 8 Z`}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div
            className="starting:translate-y-1 starting:opacity-0 transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none"
            key={current?.key}
          >
            <p className="mt-0.5 font-semibold text-2xl tabular-nums tracking-tight">
              {current ? formatInteger(current.value) : ""}
            </p>
            <p className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs">
              <span
                className={cn("size-1.5 rounded-full", current?.dotClass)}
              />
              {current?.label}
            </p>
            <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
              {share}% do total
            </p>
          </div>
        </div>
      </div>

      <RingLegend
        legendLabel={legendLabel}
        onSelect={selectSlice}
        selectedIndex={selectedSliceIndex}
        slices={slices}
        total={total}
      />
    </div>
  );
}
