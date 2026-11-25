"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SelectField } from "@/components/admin/SelectField";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  buildHistoryHref,
  type HistoryFilters as Filters,
  type HistoryPeriod,
  type HistorySituationFilter,
} from "@/features/handovers/historyFilters";
import type {
  HistoryItemChoice,
  ShiftChoice,
} from "@/features/handovers/types";

const PERIOD_OPTIONS: readonly { value: HistoryPeriod; label: string }[] = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "range", label: "Intervalo" },
];

const SITUATION_OPTIONS: readonly {
  value: HistorySituationFilter;
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: "delivered", label: "Entregues" },
  { value: "expected", label: "Esperadas" },
  { value: "awaiting", label: "Aguardando" },
  { value: "confirmed", label: "Confirmada" },
  { value: "unconfirmed", label: "Não confirmada" },
  { value: "missing", label: "Sem passagem" },
  { value: "corrected", label: "Corrigida" },
];

const ALL_SHIFTS = "all";
const ALL_ITEMS = "all";

function isPeriod(value: string): value is HistoryPeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

function isSituation(value: string): value is HistorySituationFilter {
  return SITUATION_OPTIONS.some((option) => option.value === value);
}

// Filtros do histórico, controlados. Os valores iniciais vêm da URL já
// interpretada no servidor, então nunca começam em branco. "Aplicar filtros"
// monta a URL (volta à página 1); "Limpar filtros" é um link.
export function HistoryFilters({
  filters,
  shifts,
  items = [],
  sectorParam,
}: {
  filters: Filters;
  // `active: false` = turno desativado que a URL escolheu: aparece como "(inativo)".
  shifts: readonly (ShiftChoice & { active?: boolean })[];
  items?: readonly HistoryItemChoice[];
  sectorParam: string | null;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<HistoryPeriod>(filters.period);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [shiftId, setShiftId] = useState(filters.shiftId ?? ALL_SHIFTS);
  const [itemId, setItemId] = useState(filters.itemId ?? ALL_ITEMS);
  const [situation, setSituation] = useState<HistorySituationFilter>(
    filters.situation,
  );

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildHistoryHref(
        {
          period,
          from,
          to,
          shiftId: shiftId === ALL_SHIFTS ? null : shiftId,
          situation,
          itemId: itemId === ALL_ITEMS ? null : itemId,
        },
        sectorParam === null ? {} : { sector: sectorParam },
      ),
    );
  }

  const clearHref =
    sectorParam === null
      ? "/passagens"
      : `/passagens?setor=${encodeURIComponent(sectorParam)}`;

  return (
    <form
      onSubmit={apply}
      aria-label="Filtros do histórico"
      className="flex flex-col gap-4 rounded-lg border bg-card p-3 text-card-foreground"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Período"
          value={period}
          onValueChange={(value) => {
            if (isPeriod(value)) setPeriod(value);
          }}
          options={PERIOD_OPTIONS}
        />
        {shifts.length > 0 && (
          <SelectField
            label="Turno"
            value={shiftId}
            onValueChange={setShiftId}
            options={[
              { value: ALL_SHIFTS, label: "Todos os turnos" },
              ...shifts.map((shift) => ({
                value: shift.id,
                label:
                  shift.active === false
                    ? `${shift.name} (inativo)`
                    : shift.name,
              })),
            ]}
          />
        )}
        {items.length > 0 && (
          <SelectField
            label="Item"
            value={itemId}
            onValueChange={setItemId}
            options={[
              { value: ALL_ITEMS, label: "Todos os itens" },
              ...items.map((entry) => ({
                value: entry.id,
                label: entry.active
                  ? `${entry.name} (${entry.unit})`
                  : `${entry.name} (${entry.unit}) (inativo)`,
              })),
            ]}
          />
        )}
        <SelectField
          label="Situação"
          value={situation}
          onValueChange={(value) => {
            if (isSituation(value)) setSituation(value);
          }}
          options={SITUATION_OPTIONS}
        />
        {period === "range" && (
          <>
            <Field>
              <FieldLabel htmlFor="history-from">De</FieldLabel>
              <Input
                id="history-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="history-to">Até</FieldLabel>
              <Input
                id="history-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Aplicar filtros</Button>
        <Link href={clearHref} className={buttonVariants({ variant: "ghost" })}>
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}
