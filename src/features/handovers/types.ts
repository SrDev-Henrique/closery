import type { ItemKind } from "@/lib/itemKinds";

// Tipos compartilhados da passagem. Sem I/O: o cliente também importa daqui.

export type HandoverRef = {
  sectorId: string;
  shiftId: string;
  operationalDate: string; // "YYYY-MM-DD"
};

export type ShiftChoice = {
  id: string;
  name: string;
  startsAt: string; // "HH:mm"
  endsAt: string; // "HH:mm"
};

// Escolhas dos selects do histórico: o turno ou o item inativo escolhido pela
// URL aparece como "{nome} (inativo)" em vez de sumir.
export type HistoryShiftChoice = ShiftChoice & { active: boolean };
export type HistoryItemChoice = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
};

export type FormMode = "draft" | "edit" | "correction";

// note "" = sem observação.
export type ItemLine = {
  itemId: string;
  name: string;
  unit: string;
  kind: ItemKind;
  quantity: number;
  note: string;
};

export type FieldChange =
  | { field: "occurrences"; value: string }
  | { field: "nextShift"; value: string }
  | { field: "quantity"; itemId: string; value: number }
  | { field: "note"; itemId: string; value: string };

export type SaveFieldInput = HandoverRef & FieldChange;

// Estado controlado do formulário.
export type FieldValues = {
  occurrencesText: string;
  nextShiftText: string;
  quantities: Record<string, number>; // por itemId
  notes: Record<string, string>; // por itemId, "" = sem observação
};

export type SavedMark = { at: Date; byName: string; byId: string };
