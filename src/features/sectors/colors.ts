// A paleta fechada de cores de setor (spec visual §5.1, D-V3). Arquivo puro, sem
// `server-only`: o schema do banco, o formulário (cliente) e o servidor importam daqui.
// Este é o único lugar onde a chave vira rótulo e classe; o valor da cor mora nos tokens
// `--sector-*` de globals.css (tema claro e escuro).
export const SECTOR_COLORS = [
  "lilac",
  "peach",
  "sky",
  "green",
  "pink",
] as const;

export type SectorColor = (typeof SECTOR_COLORS)[number];

export const SECTOR_COLOR_LABELS: Record<SectorColor, string> = {
  lilac: "Lilás",
  peach: "Pêssego",
  sky: "Azul",
  green: "Verde",
  pink: "Rosa",
};

// Classes escritas por extenso: o Tailwind só gera o que encontra como texto no código.
export const SECTOR_COLOR_BG: Record<SectorColor, string> = {
  lilac: "bg-sector-lilac",
  peach: "bg-sector-peach",
  sky: "bg-sector-sky",
  green: "bg-sector-green",
  pink: "bg-sector-pink",
};

export function isSectorColor(value: unknown): value is SectorColor {
  return (
    typeof value === "string" &&
    (SECTOR_COLORS as readonly string[]).includes(value)
  );
}

// Cor sugerida para um setor novo, a partir das cores dos setores ATIVOS: a primeira da
// paleta que ninguém usa; se todas estão em uso, a menos usada, e o empate vai para a
// ordem da paleta. "Menos usada" já cobre "primeira livre" (uma cor livre tem 0 usos e
// a comparação estrita `<` preserva a primeira da paleta no empate). Quem decide quais
// setores são ativos é o chamador (`suggestColorForNewSector`).
export function suggestSectorColor(
  activeColors: readonly SectorColor[],
): SectorColor {
  const uses = new Map<SectorColor, number>(
    SECTOR_COLORS.map((color) => [color, 0]),
  );
  for (const color of activeColors) {
    uses.set(color, (uses.get(color) ?? 0) + 1);
  }

  let best: SectorColor = SECTOR_COLORS[0];
  let bestUses = uses.get(best) ?? 0;
  for (const color of SECTOR_COLORS) {
    const count = uses.get(color) ?? 0;
    if (count < bestUses) {
      best = color;
      bestUses = count;
    }
  }
  return best;
}
