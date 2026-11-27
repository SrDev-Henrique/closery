import type { ShiftProgress } from "@/features/handovers/shiftProgress";

// Barra do turno do cartão "Passagem do meu turno" (estados start e continue).
// O servidor já calculou tudo (`shiftProgress`); aqui só se desenha. Trilho de
// 10px e preenchimento em tinta de pastel; a largura é presa entre 0 e 100.
export function ShiftProgressBar({ progress }: { progress: ShiftProgress }) {
  const pct = Number.isFinite(progress.pct)
    ? Math.min(100, Math.max(0, progress.pct))
    : 0;
  const rounded = Math.round(pct);
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label="Progresso do turno"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        aria-valuetext={`Turno em ${rounded}%, agora ${progress.nowLabel}`}
        className="h-2.5 overflow-hidden rounded-full bg-on-pastel-track"
      >
        <div
          className="h-full rounded-full bg-on-pastel"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between font-mono text-xs font-medium text-on-pastel-muted tabular-nums">
        <span>{progress.startLabel}</span>
        <span>agora {progress.nowLabel}</span>
        <span>{progress.endLabel}</span>
      </div>
    </div>
  );
}
