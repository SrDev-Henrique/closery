import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";

// Pílula do operador no Início: o setor dele, só para leitura (spec §6.2). O
// admin troca de setor pelo `SectorPicker`; quem tem um setor só vê qual é.
export function SectorPill({
  name,
  color,
}: {
  name: string;
  color: SectorColor;
}) {
  return (
    <div
      data-slot="sector-pill"
      className="flex h-12 max-w-full items-center gap-2.5 rounded-full bg-card px-5"
    >
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${SECTOR_COLOR_BG[color]}`}
      />
      <span className="shrink-0 font-mono text-xs font-medium tracking-[0.06em] text-muted-foreground uppercase">
        Setor
      </span>
      <span className="min-w-0 truncate font-heading text-base font-bold">
        {name}
      </span>
    </div>
  );
}
