"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import { SelectField } from "@/components/admin/SelectField";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DESTINATION_OTHER,
  SEARCH_MAX_LENGTH,
} from "@/features/requests/limits";
import {
  buildRequestsHref,
  clearFiltersHref,
  type RequestFilters,
  type RequestPeriod,
  resetPaging,
} from "@/features/requests/requestFilters";
import { normalizeSearch } from "@/features/requests/search";
import type {
  FilterDestination,
  PersonChoice,
} from "@/features/requests/types";

const ALL = "all";

const PERIOD_OPTIONS: readonly { value: RequestPeriod; label: string }[] = [
  { value: "all", label: "Todo o período" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "range", label: "Intervalo" },
];

function isPeriod(value: string): value is RequestPeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

// Filtros das solicitações, controlados. Os valores iniciais vêm da URL já
// interpretada no servidor, então nunca começam em branco. "Aplicar filtros"
// monta a URL (volta à primeira página, mantém visão e setor); "Limpar
// filtros" é um link.
export function RequestFiltersForm({
  filters,
  destinations,
  creators,
  sectorParam,
}: {
  filters: RequestFilters;
  destinations: readonly FilterDestination[];
  creators: readonly PersonChoice[];
  sectorParam: string | null;
}) {
  const router = useRouter();
  const uid = useId();
  const [destination, setDestination] = useState(filters.destination ?? ALL);
  const [period, setPeriod] = useState<RequestPeriod>(filters.period);
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const [creatorId, setCreatorId] = useState(filters.creatorId ?? ALL);
  const [search, setSearch] = useState(filters.search);
  const extras = sectorParam === null ? {} : { sector: sectorParam };

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildRequestsHref(
        resetPaging({
          ...filters,
          destination: destination === ALL ? null : destination,
          period,
          from: period === "range" ? from : null,
          to: period === "range" ? to : null,
          creatorId: creatorId === ALL ? null : creatorId,
          search: normalizeSearch(search),
        }),
        extras,
      ),
    );
  }

  return (
    <form
      onSubmit={apply}
      aria-label="Filtros das solicitações"
      className="flex flex-col gap-4 rounded-lg border bg-card p-3 text-card-foreground"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field>
          <FieldLabel htmlFor={`${uid}-search`}>Busca</FieldLabel>
          <Input
            id={`${uid}-search`}
            type="search"
            className="text-base md:text-base"
            placeholder="Descrição ou destino"
            maxLength={SEARCH_MAX_LENGTH}
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <SelectField
          label="Destino"
          value={destination}
          onValueChange={setDestination}
          options={[
            { value: ALL, label: "Todos os destinos" },
            ...destinations.map((entry) => ({
              value: entry.id,
              label: entry.active ? entry.name : `${entry.name} (inativo)`,
            })),
            { value: DESTINATION_OTHER, label: "Outro" },
          ]}
        />
        <SelectField
          label="Período"
          value={period}
          onValueChange={(value) => {
            if (isPeriod(value)) setPeriod(value);
          }}
          options={PERIOD_OPTIONS}
        />
        <SelectField
          label="Quem criou"
          value={creatorId}
          onValueChange={setCreatorId}
          options={[
            { value: ALL, label: "Todas as pessoas" },
            ...creators.map((person) => ({
              value: person.id,
              label: person.name,
            })),
          ]}
        />
        {period === "range" && (
          <>
            <Field>
              <FieldLabel htmlFor={`${uid}-from`}>De</FieldLabel>
              <Input
                id={`${uid}-from`}
                type="date"
                className="text-base md:text-base"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${uid}-to`}>Até</FieldLabel>
              <Input
                id={`${uid}-to`}
                type="date"
                className="text-base md:text-base"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Aplicar filtros</Button>
        <Link
          href={clearFiltersHref(filters.view, extras)}
          className={buttonVariants({ variant: "ghost" })}
        >
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}
