// Escala do Tailwind: 1 unidade = 4px (h-9 = 36px, h-11 = 44px).
export const MIN_DESKTOP_UNIT = 9;
export const TOUCH_UNIT = 11;

/**
 * Lê a altura (h-N ou size-N) de uma string de classes, só da variante pedida:
 * "" para a classe pura, "max-md:" para o modificador de celular.
 */
export function heightUnit(
  className: string,
  prefix: "" | "max-md:",
): number | null {
  const pattern = new RegExp(`^${prefix}(?:h|size)-([0-9]+(?:[.][0-9]+)?)$`);
  for (const name of className.split(" ")) {
    const match = pattern.exec(name);
    if (match) return Number(match[1]);
  }
  return null;
}
