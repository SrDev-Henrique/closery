// Números no padrão pt-BR, sempre com o mesmo locale (o do runtime pode
// diferir entre servidor e navegador e gerar divergência de hidratação).
const INTEGER = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const DECIMAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** 1234 → "1.234"; 0 → "0". */
export function formatInteger(value: number): string {
  return INTEGER.format(value);
}

/** 12.5 → "12,5"; 12 → "12"; 0.05 → "0,1" (uma casa, só quando ela existe). */
export function formatDecimal(value: number): string {
  return DECIMAL.format(value);
}
