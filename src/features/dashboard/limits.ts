// Constantes do dashboard. Sem I/O: o cliente também importa daqui.
// Reaproveitados sem copiar: HISTORY_MAX_DAYS, HISTORY_DEFAULT_DAYS e
// ALL_SECTORS (features/handovers/limits), DESTINATION_OTHER (features/requests/limits).
export const DASHBOARD_PATH = "/dashboard";
export const DASHBOARD_EXPORT_PATH = "/api/dashboard/export";
export const SEGMENT_SLOTS = 4; // turnos com cor própria; do 5º em diante, a cor neutra (limita cores, não linhas)
export const DASHBOARD_ITEM_LIMIT = 30; // cartões por bloco (Controles, Estoque)
export const DESTINATION_BAR_LIMIT = 8; // barras de tempo até a entrega
export const REQUESTED_ITEM_LIMIT = 12; // linhas de quantidade pedida
export const CSV_MAX_ROWS = 10_000; // teto de linhas do CSV (o período já é ≤ 93 dias)
export const CSV_FILENAME_SLUG_MAX = 48; // caracteres do slug do setor
export const MIN_BAR_PERCENT = 2; // barra de valor > 0 nunca some
