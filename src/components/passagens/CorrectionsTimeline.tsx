import {
  correctionFieldLabel,
  displayCorrectionValue,
} from "@/features/handovers/diff";
import type { SummaryCorrection } from "@/features/handovers/summary";
import { formatDateTimeBR } from "@/lib/dateTime";

// Linha do tempo (dado ordenado no tempo não é tabela): uma entrada por campo.
export function CorrectionsTimeline({
  corrections,
}: {
  corrections: readonly SummaryCorrection[];
}) {
  if (corrections.length === 0) return null;

  return (
    <ol className="flex flex-col gap-4 border-l pl-4">
      {corrections.map((correction) => (
        <li key={correction.id} className="flex flex-col gap-1">
          <span className="font-medium">
            {correctionFieldLabel(correction.field, correction.itemName)}
          </span>
          <span className="whitespace-pre-wrap">
            {`${displayCorrectionValue(correction.oldValue)} → ${displayCorrectionValue(correction.newValue)}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {`Motivo: ${correction.reason}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {`${correction.correctedByName} · ${formatDateTimeBR(correction.correctedAt)}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
