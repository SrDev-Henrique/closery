"use client";

import { Plus, Trash2 } from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";

import { createRequestAction } from "@/app/(app)/solicitacoes/actions";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { QuantityCounter } from "@/components/passagens/QuantityCounter";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FieldErrors } from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import type { SectorChoice } from "@/features/admin/sectors";
import type { HandoverRef } from "@/features/handovers/types";
import {
  DESCRIPTION_MAX_LENGTH,
  DESTINATION_OTHER,
  DESTINATION_OTHER_MAX_LENGTH,
  REQUEST_ITEM_MIN_QUANTITY,
} from "@/features/requests/limits";
import { createRequestSchema } from "@/features/requests/schemas";
import type {
  RequestFormChoices,
  RequestItemInput,
  SectorFormChoices,
  StockItemChoice,
} from "@/features/requests/types";

// Campos que têm onde mostrar o erro; qualquer outro vira o erro do pé.
const FORM_FIELDS = [
  "sectorId",
  "destinationId",
  "destinationOther",
  "description",
  "items",
] as const;

// Linha de item no estado do cliente; `key` é só para o React e não vai no payload.
type ItemLine = RequestItemInput & { key: number };

const NO_SECTOR_CHOICES: SectorFormChoices = {
  stockItems: [],
  defaultDestinationId: null,
};

// Formulário de nova solicitação (F4-9). O MESMO na tela de solicitações e na
// passagem. Nunca começa em branco: o destino já vem escolhido (o mais usado
// do setor) e cada item entra com quantidade 1. Valida com o schema do
// servidor antes de chamar a action; o erro do servidor vai para o campo certo
// e nada do que foi digitado se perde.
export function RequestForm({
  sectors,
  initialSectorId,
  choices,
  originRef,
  onCreated,
  onCancel,
}: {
  sectors: readonly SectorChoice[] | null;
  initialSectorId: string;
  choices: RequestFormChoices;
  originRef: HandoverRef | null;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [sectorId, setSectorId] = useState(initialSectorId);
  const [destinationId, setDestinationId] = useState<string>(
    () =>
      choices.bySector[initialSectorId]?.defaultDestinationId ??
      DESTINATION_OTHER,
  );
  const [destinationOther, setDestinationOther] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ItemLine[]>([]);
  const nextLineKey = useRef(0);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const sectorChoices = choices.bySector[sectorId] ?? NO_SECTOR_CHOICES;
  const stockById = new Map<string, StockItemChoice>(
    sectorChoices.stockItems.map((stock) => [stock.id, stock]),
  );
  const chosenIds = new Set(items.map((line) => line.itemId));
  const nextItem = sectorChoices.stockItems.find(
    (stock) => !chosenIds.has(stock.id),
  );
  const isOther = destinationId === DESTINATION_OTHER;
  const destinationOptions = [
    ...choices.destinations.map((option) => ({
      value: option.id,
      label: option.name,
    })),
    { value: DESTINATION_OTHER, label: "Outro" },
  ];

  function changeSector(next: string) {
    // Os itens são do setor: trocar de setor limpa a lista e mantém o destino.
    setSectorId(next);
    setItems([]);
  }

  function addItem() {
    if (!nextItem) return;
    const key = nextLineKey.current++;
    setItems((current) => [
      ...current,
      {
        key,
        itemId: nextItem.id,
        quantity: REQUEST_ITEM_MIN_QUANTITY,
      },
    ]);
  }

  function replaceItem(index: number, itemId: string) {
    setItems((current) =>
      current.map((line, at) => (at === index ? { ...line, itemId } : line)),
    );
  }

  function setQuantity(index: number, quantity: number) {
    setItems((current) =>
      current.map((line, at) => (at === index ? { ...line, quantity } : line)),
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, at) => at !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const payload = {
      sectorId,
      destinationId: isOther ? null : destinationId,
      destinationOther: isOther ? destinationOther : "",
      description,
      items: items.map(({ itemId, quantity }) => ({ itemId, quantity })),
      originRef,
    };
    const parsed = createRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run(() => createRequestAction(payload), {
      showError: false,
      success: "Solicitação criada.",
    });
    if (result.ok) {
      onCreated(result.id);
      return;
    }
    const errors = result.fieldErrors ?? {};
    setFieldErrors(errors);
    const shownInField = FORM_FIELDS.some((field) => errors[field]);
    setFormError(shownInField ? null : result.message);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {sectors !== null && (
          <SelectField
            id={`${uid}-sector`}
            label="Setor"
            value={sectorId}
            onValueChange={changeSector}
            options={sectors.map((sector) => ({
              value: sector.id,
              label: sector.name,
            }))}
            error={fieldErrors.sectorId}
            disabled={pending}
          />
        )}

        <SelectField
          id={`${uid}-destination`}
          label="Destino"
          value={destinationId}
          onValueChange={setDestinationId}
          options={destinationOptions}
          error={fieldErrors.destinationId}
          disabled={pending}
        />

        {isOther && (
          <Field data-invalid={fieldErrors.destinationOther ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-other`}>Qual destino?</FieldLabel>
            <Input
              id={`${uid}-other`}
              type="text"
              autoComplete="off"
              className="text-base md:text-base"
              maxLength={DESTINATION_OTHER_MAX_LENGTH}
              value={destinationOther}
              disabled={pending}
              aria-invalid={fieldErrors.destinationOther ? true : undefined}
              aria-describedby={
                fieldErrors.destinationOther ? `${uid}-other-error` : undefined
              }
              onChange={(event) => setDestinationOther(event.target.value)}
            />
            {fieldErrors.destinationOther && (
              <FieldError id={`${uid}-other-error`}>
                {fieldErrors.destinationOther}
              </FieldError>
            )}
          </Field>
        )}

        <Field data-invalid={fieldErrors.description ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-description`}>Descrição</FieldLabel>
          <Textarea
            id={`${uid}-description`}
            className="text-base md:text-base"
            maxLength={DESCRIPTION_MAX_LENGTH}
            value={description}
            disabled={pending}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={`${uid}-description-help${
              fieldErrors.description ? ` ${uid}-description-error` : ""
            }`}
            onChange={(event) => setDescription(event.target.value)}
          />
          <FieldDescription id={`${uid}-description-help`}>
            Obrigatória. O que precisa e para quando.
          </FieldDescription>
          {fieldErrors.description && (
            <FieldError id={`${uid}-description-error`}>
              {fieldErrors.description}
            </FieldError>
          )}
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Itens</FieldLegend>
          <FieldDescription>
            Opcional. Itens de estoque do setor.
          </FieldDescription>
          {sectorChoices.stockItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item de estoque neste setor.
            </p>
          ) : (
            <>
              {items.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {items.map((line, index) => {
                    const stock = stockById.get(line.itemId);
                    const name = stock?.name ?? "Item";
                    const options = sectorChoices.stockItems.filter(
                      (option) =>
                        option.id === line.itemId || !chosenIds.has(option.id),
                    );
                    return (
                      <li
                        key={line.key}
                        className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                      >
                        <NativeSelect
                          className="w-full sm:flex-1"
                          aria-label="Item"
                          value={line.itemId}
                          disabled={pending}
                          onChange={(event) =>
                            replaceItem(index, event.target.value)
                          }
                        >
                          {options.map((option) => (
                            <NativeSelectOption
                              key={option.id}
                              value={option.id}
                            >
                              {option.name}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                        <div className="flex items-center justify-between gap-2">
                          <QuantityCounter
                            label={name}
                            unit={stock?.unit ?? ""}
                            value={line.quantity}
                            min={REQUEST_ITEM_MIN_QUANTITY}
                            disabled={pending}
                            onChange={(quantity) =>
                              setQuantity(index, quantity)
                            }
                          />
                          <RemoveItemButton
                            name={name}
                            disabled={pending}
                            onClick={() => removeItem(index)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={pending || !nextItem}
                onClick={addItem}
              >
                <Plus aria-hidden="true" />
                Adicionar item
              </Button>
            </>
          )}
          {fieldErrors.items && <FieldError>{fieldErrors.items}</FieldError>}
        </FieldSet>

        {formError && <FieldError>{formError}</FieldError>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onCancel}
          >
            Voltar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Criando…" : "Criar solicitação"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

// Controle só com ícone: tooltip e aria-label.
function RemoveItemButton({
  name,
  disabled,
  onClick,
}: {
  name: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remover ${name}`}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        <Trash2 aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Remover item</TooltipContent>
    </Tooltip>
  );
}
