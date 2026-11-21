import type { ItemKind } from "@/lib/itemKinds";

import { normalizeName } from "./names";

export const ITEM_UNITS = [
  "unidade",
  "rolo",
  "par",
  "pacote",
  "caixa",
  "saco",
  "metro",
  "kg",
] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

export const OTHER_UNIT = "outro" as const;
export type UnitChoice = ItemUnit | typeof OTHER_UNIT;

export const DEFAULT_UNIT: ItemUnit = "unidade";
export const UNIT_MAX_LENGTH = 20;

export const ITEM_UNIT_LABELS: Readonly<Record<ItemUnit, string>> = {
  unidade: "Unidade",
  rolo: "Rolo",
  par: "Par",
  pacote: "Pacote",
  caixa: "Caixa",
  saco: "Saco",
  metro: "Metro",
  kg: "kg",
};

export const ITEM_KIND_LABELS: Readonly<Record<ItemKind, string>> = {
  control: "Controle",
  stock: "Estoque",
};

export const ITEM_KIND_HELP: Readonly<Record<ItemKind, string>> = {
  control: "Controle: soma no período, como redes danificadas.",
  stock: "Estoque: vale a última contagem, nunca a soma.",
};

export type ItemFormValues = {
  name: string;
  unitChoice: UnitChoice;
  unitOther: string;
  kind: ItemKind;
};

export const ITEM_FORM_DEFAULTS: ItemFormValues = {
  name: "",
  unitChoice: DEFAULT_UNIT,
  unitOther: "",
  kind: "control",
};

function isItemUnit(value: string): value is ItemUnit {
  return ITEM_UNITS.some((unit) => unit === value);
}

export function resolveUnit(
  choice: string,
  other: string,
):
  | { ok: true; unit: string }
  | { ok: false; field: "unitChoice" | "unitOther"; message: string } {
  if (isItemUnit(choice)) return { ok: true, unit: choice };

  if (choice !== OTHER_UNIT) {
    return { ok: false, field: "unitChoice", message: "Escolha uma unidade." };
  }

  const text = normalizeName(other);
  if (text === "") {
    return { ok: false, field: "unitOther", message: "Informe a unidade." };
  }
  if ([...text].length > UNIT_MAX_LENGTH) {
    return {
      ok: false,
      field: "unitOther",
      message: `A unidade pode ter no máximo ${UNIT_MAX_LENGTH} caracteres.`,
    };
  }

  // "Rolo" digitado em "Outro" é o "rolo" da lista: uma só grafia no banco.
  const known = ITEM_UNITS.find((unit) => unit === text.toLowerCase());
  return { ok: true, unit: known ?? text };
}

/** Unidade gravada → o que o formulário mostra; fora da lista vira "Outro". */
export function splitUnit(unit: string): { choice: UnitChoice; other: string } {
  if (isItemUnit(unit)) return { choice: unit, other: "" };
  return { choice: OTHER_UNIT, other: unit };
}
