"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { linkExtras } from "@/features/dashboard/links";
import {
  buildDashboardHref,
  dashboardPresetHref,
  validateRangeInput,
} from "@/features/dashboard/period";
import type { HistoryPeriodRange } from "@/features/handovers/historyFilters";

type RangeError = { field: "from" | "to"; message: string };

// Período do dashboard: dois atalhos (links) e um intervalo (disclosure). O
// intervalo é validado aqui antes de navegar e nunca volta em silêncio para
// outro período; o servidor continua corrigindo o que chegar (defesa).
export function DashboardPeriodPicker({
  period,
  today,
  sectorParam,
}: {
  period: HistoryPeriodRange;
  today: string;
  sectorParam: string | null;
}) {
  const router = useRouter();
  const formId = useId();
  const fromId = useId();
  const toId = useId();
  const [open, setOpen] = useState(period.period === "range");
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);
  const [error, setError] = useState<RangeError | null>(null);
  const extras = linkExtras(sectorParam);

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateRangeInput(from, to, today);
    if (!result.ok) {
      setError({ field: result.field, message: result.message });
      return;
    }
    setError(null);
    router.push(buildDashboardHref(result.range, extras));
  }

  const isRange = period.period === "range";

  return (
    <nav aria-label="Período" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={dashboardPresetHref("7", extras)}
          aria-current={period.period === "7" ? "page" : undefined}
          className={buttonVariants({
            variant: period.period === "7" ? "default" : "outline",
          })}
        >
          Últimos 7 dias
        </Link>
        <Link
          href={dashboardPresetHref("30", extras)}
          aria-current={period.period === "30" ? "page" : undefined}
          className={buttonVariants({
            variant: period.period === "30" ? "default" : "outline",
          })}
        >
          Últimos 30 dias
        </Link>
        <Button
          type="button"
          variant={isRange ? "default" : "outline"}
          aria-expanded={open}
          aria-controls={formId}
          onClick={() => setOpen((current) => !current)}
        >
          Intervalo
        </Button>
      </div>
      <form
        id={formId}
        hidden={!open}
        noValidate
        onSubmit={apply}
        aria-label="Intervalo do período"
        aria-current={isRange ? "true" : undefined}
        className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field data-invalid={error?.field === "from" ? "true" : undefined}>
            <FieldLabel htmlFor={fromId}>De</FieldLabel>
            <Input
              id={fromId}
              type="date"
              max={today}
              value={from}
              aria-invalid={error?.field === "from" ? true : undefined}
              onChange={(event) => {
                setFrom(event.target.value);
                setError(null);
              }}
            />
            {error?.field === "from" && (
              <FieldError>{error.message}</FieldError>
            )}
          </Field>
          <Field data-invalid={error?.field === "to" ? "true" : undefined}>
            <FieldLabel htmlFor={toId}>Até</FieldLabel>
            <Input
              id={toId}
              type="date"
              max={today}
              value={to}
              aria-invalid={error?.field === "to" ? true : undefined}
              onChange={(event) => {
                setTo(event.target.value);
                setError(null);
              }}
            />
            {error?.field === "to" && <FieldError>{error.message}</FieldError>}
          </Field>
        </div>
        <div>
          <Button type="submit">Aplicar intervalo</Button>
        </div>
      </form>
    </nav>
  );
}
