import { useId } from "react";

import { formatQuantity } from "@/features/handovers/quantity";
import type { SummaryItem } from "@/features/handovers/summary";

export function SummaryItemList({
  title,
  items,
}: {
  title: string;
  items: readonly SummaryItem[];
}) {
  const headingId = useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {items.map((line) => (
          <li key={line.itemId} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{line.name}</span>
              <span className="shrink-0 text-right tabular-nums">
                {`${formatQuantity(line.quantity)} ${line.unit}`}
              </span>
            </div>
            {line.note && (
              <p className="text-sm text-muted-foreground">{line.note}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
