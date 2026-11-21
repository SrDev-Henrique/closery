// Fora de src/db para o cliente poder importar sem arrastar o drizzle
// (mesmo padrão de roles.ts). O schema reexporta de catalog.ts.
export const ITEM_KINDS = ["control", "stock"] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];
