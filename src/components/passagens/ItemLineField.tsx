"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ITEM_NOTE_MAX_LENGTH } from "@/features/handovers/limits";
import type { ItemLine } from "@/features/handovers/types";
import { QuantityCounter } from "./QuantityCounter";

// Uma linha de item: nome, contador e observação opcional (recolhida até a
// pessoa pedir; já abre sozinha quando existe uma).
export function ItemLineField({
  line,
  quantity,
  note,
  onQuantityChange,
  onQuantityCommit,
  onNoteChange,
  onNoteCommit,
  disabled = false,
}: {
  line: ItemLine;
  quantity: number;
  note: string;
  onQuantityChange: (value: number) => void;
  onQuantityCommit: (value: number) => void;
  onNoteChange: (value: string) => void;
  onNoteCommit: (value: string) => void;
  disabled?: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(note !== "");

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="font-medium">{line.name}</span>
        <QuantityCounter
          label={line.name}
          unit={line.unit}
          value={quantity}
          onChange={onQuantityChange}
          onCommit={onQuantityCommit}
          disabled={disabled}
        />
      </div>
      {noteOpen ? (
        <Input
          type="text"
          autoComplete="off"
          maxLength={ITEM_NOTE_MAX_LENGTH}
          className="text-base md:text-base"
          aria-label={`Observação de ${line.name}`}
          value={note}
          disabled={disabled}
          onChange={(event) => onNoteChange(event.target.value)}
          onBlur={(event) => onNoteCommit(event.target.value)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-label={`Adicionar observação em ${line.name}`}
          disabled={disabled}
          onClick={() => setNoteOpen(true)}
        >
          <Plus aria-hidden="true" />
          Adicionar observação
        </Button>
      )}
    </li>
  );
}
