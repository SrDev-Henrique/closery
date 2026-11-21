const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** "28/11/2026, 14:30" no fuso de São Paulo, qualquer que seja o fuso do servidor. */
export function formatDateTimeBR(date: Date): string {
  return formatter.format(date);
}
