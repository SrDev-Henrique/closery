import { MAX_QUANTITY } from "./limits";

const MAX_DIGITS = String(MAX_QUANTITY).length;
const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR");

/** Só dígitos, sem zeros à esquerda ("007" → "7", "000" → "0"), no máximo 5 dígitos. "" fica "". */
export function sanitizeQuantityInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.slice(0, MAX_DIGITS);
}

/** "" → null; "12" → 12; acima do teto → MAX_QUANTITY. Ignora tudo que não é dígito. */
export function parseQuantity(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  return Math.min(Number(digits), MAX_QUANTITY);
}

/** Soma ou subtrai 1; trava em `min` (padrão 0) e em MAX_QUANTITY. */
export function stepQuantity(value: number, delta: 1 | -1, min = 0): number {
  return Math.min(Math.max(value + delta, min), MAX_QUANTITY);
}

/** pt-BR: 1234 → "1.234". */
export function formatQuantity(value: number): string {
  return NUMBER_FORMAT.format(value);
}
