// Valor de um search param do Next (`string | string[] | undefined`): parâmetro
// repetido (`?a=1&a=2`) vale o primeiro; lista vazia, nenhum.
export function firstValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
