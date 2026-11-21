"use client";

import { TriangleAlert } from "lucide-react";
import { useId } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { TEXT_MAX_LENGTH } from "@/features/handovers/limits";
import { formatQuantity } from "@/features/handovers/quantity";
import type {
  FieldChange,
  FieldValues,
  ItemLine,
} from "@/features/handovers/types";
import { ItemLineField } from "./ItemLineField";

const COUNTER_THRESHOLD = Math.floor(TEXT_MAX_LENGTH * 0.9);

function ItemSection({
  title,
  help,
  lines,
  values,
  onChange,
  onCommit,
  disabled,
}: {
  title: string;
  help: string;
  lines: readonly ItemLine[];
  values: FieldValues;
  onChange: (change: FieldChange) => void;
  onCommit: (change: FieldChange) => void;
  disabled: boolean;
}) {
  const headingId = useId();
  if (lines.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{help}</p>
      <ul className="flex flex-col divide-y">
        {lines.map((line) => (
          <ItemLineField
            key={line.itemId}
            line={line}
            quantity={values.quantities[line.itemId] ?? 0}
            note={values.notes[line.itemId] ?? ""}
            disabled={disabled}
            onQuantityChange={(value) =>
              onChange({ field: "quantity", itemId: line.itemId, value })
            }
            onQuantityCommit={(value) =>
              onCommit({ field: "quantity", itemId: line.itemId, value })
            }
            onNoteChange={(value) =>
              onChange({ field: "note", itemId: line.itemId, value })
            }
            onNoteCommit={(value) =>
              onCommit({ field: "note", itemId: line.itemId, value })
            }
          />
        ))}
      </ul>
    </section>
  );
}

function TextSection({
  title,
  description,
  value,
  onChange,
  onCommit,
  disabled,
  emphasized = false,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  disabled: boolean;
  emphasized?: boolean;
}) {
  const id = useId();
  return (
    <section
      className={
        emphasized
          ? "rounded-lg border-2 border-warning-foreground/40 bg-warning/30 p-4"
          : undefined
      }
    >
      <Field>
        <FieldLabel htmlFor={id} className="text-lg font-semibold">
          {emphasized && (
            <TriangleAlert aria-hidden="true" className="size-4" />
          )}
          {title}
        </FieldLabel>
        <FieldDescription>{description}</FieldDescription>
        <Textarea
          id={id}
          rows={4}
          maxLength={TEXT_MAX_LENGTH}
          className="text-base md:text-base"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit(event.target.value)}
        />
        {value.length >= COUNTER_THRESHOLD && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatQuantity(value.length)} de {formatQuantity(TEXT_MAX_LENGTH)}{" "}
            caracteres
          </p>
        )}
      </Field>
    </section>
  );
}

// Corpo do formulário da passagem, sem estado próprio: valores e eventos vêm
// do pai (que decide salvar sozinho ou só ao registrar a correção).
export function HandoverFields({
  controls,
  stock,
  values,
  onChange,
  onCommit,
  disabled = false,
  canManageCatalog,
  itemsHref,
}: {
  controls: readonly ItemLine[];
  stock: readonly ItemLine[];
  values: FieldValues;
  onChange: (change: FieldChange) => void;
  onCommit: (change: FieldChange) => void;
  disabled?: boolean;
  canManageCatalog: boolean;
  itemsHref: string;
}) {
  const noItems = controls.length === 0 && stock.length === 0;

  return (
    <FieldGroup className="gap-8">
      {noItems ? (
        <EmptyState
          title="Nenhum item neste setor."
          description={
            canManageCatalog
              ? "Cadastre os itens do setor para contá-los na passagem."
              : "Peça a um administrador para cadastrar os itens. Você ainda pode entregar o turno com as ocorrências."
          }
          action={
            canManageCatalog
              ? { label: "Ir para Itens", href: itemsHref }
              : undefined
          }
        />
      ) : (
        <>
          <ItemSection
            title="Controles"
            help="Soma no período, como redes danificadas."
            lines={controls}
            values={values}
            onChange={onChange}
            onCommit={onCommit}
            disabled={disabled}
          />
          <ItemSection
            title="Estoque"
            help="Contagem de agora. Vale a última, nunca a soma."
            lines={stock}
            values={values}
            onChange={onChange}
            onCommit={onCommit}
            disabled={disabled}
          />
        </>
      )}
      <TextSection
        title="Ocorrências do turno"
        description="Opcional. Conte o que saiu do normal."
        value={values.occurrencesText}
        disabled={disabled}
        onChange={(value) => onChange({ field: "occurrences", value })}
        onCommit={(value) => onCommit({ field: "occurrences", value })}
      />
      <TextSection
        title="Fica para o próximo turno"
        description="Opcional. O que quem recebe precisa saber primeiro."
        value={values.nextShiftText}
        disabled={disabled}
        emphasized
        onChange={(value) => onChange({ field: "nextShift", value })}
        onCommit={(value) => onCommit({ field: "nextShift", value })}
      />
    </FieldGroup>
  );
}
