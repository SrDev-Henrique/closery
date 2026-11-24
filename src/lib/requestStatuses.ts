// Fora de src/db para o cliente poder importar sem arrastar o drizzle
// (mesmo padrão de itemKinds.ts). O schema reexporta de requests.ts.
export const REQUEST_STATUSES = [
  "requested",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];
