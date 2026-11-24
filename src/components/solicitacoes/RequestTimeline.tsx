import { timelineSentence } from "@/features/requests/timeline";
import type { RequestTimelineEntry } from "@/features/requests/types";
import { formatDateTimeBR } from "@/lib/dateTime";
import { cn } from "@/lib/utils";

import { REQUEST_STATUS_STYLE } from "./statusStyle";

// Linha do tempo: mais antigo primeiro. O ícone é o do status de destino; o
// motivo do cancelamento aparece junto do "cancelou".
export function RequestTimeline({
  entries,
}: {
  entries: readonly RequestTimelineEntry[];
}) {
  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => {
        const { icon: Icon, badgeClass } = REQUEST_STATUS_STYLE[entry.to];
        return (
          <li key={entry.id} className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                badgeClass,
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-sm font-medium">{timelineSentence(entry)}</p>
              <time
                dateTime={entry.at.toISOString()}
                className="text-xs text-muted-foreground tabular-nums"
              >
                {formatDateTimeBR(entry.at)}
              </time>
              {entry.reason !== null && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  Motivo: {entry.reason}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
