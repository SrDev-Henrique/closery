import Link from "next/link";

import { SINGLE_BAR_CLASS } from "@/components/dashboard/chartColors";
import { barPercent } from "@/features/dashboard/format";

export type BarListRow = {
  key: string;
  label: string;
  context?: string | null;
  value: number;
  valueText: string;
  detail: string;
  href: string;
};

// Linhas com o valor escrito ao lado (a escala é o próprio número); com
// `bars`, uma barra proporcional ao maior valor mostrado. Cada linha é um link.
export function BarList({
  label,
  rows,
  bars,
  emptyText,
  moreText,
}: {
  label: string;
  rows: readonly BarListRow[];
  bars: boolean;
  emptyText: string;
  moreText: string | null;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((row) => row.value));
  return (
    <div className="flex flex-col gap-2">
      <ul aria-label={label} className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.key}>
            <Link
              href={row.href}
              className="flex min-h-11 flex-col justify-center gap-1 rounded-lg border bg-card px-3 py-2 text-card-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">
                  {row.label}
                  {row.context && (
                    <>
                      {" "}
                      <span className="font-normal text-muted-foreground">
                        {`· ${row.context}`}
                      </span>
                    </>
                  )}
                </span>{" "}
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {row.valueText}
                  </span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {row.detail}
                  </span>
                </span>
              </span>
              {bars && (
                <span
                  aria-hidden="true"
                  className="h-2 w-full overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className={`block h-full rounded-full ${SINGLE_BAR_CLASS}`}
                    style={{ width: `${barPercent(row.value, max)}%` }}
                  />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {moreText && <p className="text-xs text-muted-foreground">{moreText}</p>}
    </div>
  );
}
