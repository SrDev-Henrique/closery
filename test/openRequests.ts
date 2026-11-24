import type {
  OpenRequestSummary,
  RequestAtDelivery,
} from "@/features/requests/types";

let counter = 0;

// Resumo de solicitação aberta para os testes de componente (seções da
// passagem e cartão do Início): id único, Solicitada, 1 dia, não parada.
export function openRequest(
  overrides: Partial<OpenRequestSummary> = {},
): OpenRequestSummary {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    description: "Trocar redes do box 4",
    destinationName: "Doca 3",
    status: "requested",
    daysInStatus: 1,
    stale: false,
    ...overrides,
  };
}

export function requestAtDelivery(
  overrides: Partial<RequestAtDelivery> = {},
): RequestAtDelivery {
  const base = openRequest(overrides);
  return { ...base, statusNow: base.status, ...overrides };
}
