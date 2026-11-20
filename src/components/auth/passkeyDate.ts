const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

// O dia mostrado é o do fuso da operação, não o do servidor nem o do aparelho.
export function formatPasskeyDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatter.format(date);
}
