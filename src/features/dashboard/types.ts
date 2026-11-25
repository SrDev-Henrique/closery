import type { HistoryPeriodRange } from "@/features/handovers/historyFilters";

// Tipos do dashboard. Sem I/O: o cliente também importa daqui (só tipos).

export type DateRange = { from: string; to: string }; // "YYYY-MM-DD", inclusive

// O domínio refaz o escopo (sectorScopeOf) a partir de `sectorId`.
export type DashboardQuery = {
  sectorId: string | null;
  period: DateRange;
  previous: DateRange;
};

export type DashboardScope = {
  sectorId: string | null; // null = "Todos os setores" (admin)
  sectorName: string | null; // nome do setor escolhido / do operador; null em "Todos os setores"
  sectorParam: string | null; // ?setor= dos links (admin: id ou "todos"); operador: null
  showSector: boolean; // admin em "Todos os setores": cartões e linhas mostram o setor
  period: HistoryPeriodRange; // o atual
  previous: DateRange; // os N dias imediatamente antes
  days: number; // N (1..93)
  today: string; // hoje em São Paulo
};

export type PassagesData = {
  expected: number;
  delivered: number;
  confirmed: number;
  awaiting: number;
  unconfirmed: number;
  missing: number;
  listed: number;
};

export type SegmentSlot = 1 | 2 | 3 | 4 | null; // null = 5º turno em diante (cor neutra; o segmento continua sendo de um turno só)

export type ControlSegment = {
  key: string; // = shiftId
  shiftId: string;
  label: string;
  slot: SegmentSlot;
  total: number;
  previousTotal: number;
};

export type SeriesPoint = { date: string; total: number; parts: number[] }; // parts na ordem de `segments`; total do SQL

export type ControlItemMetric = {
  itemId: string;
  sectorId: string;
  sectorName: string;
  name: string;
  unit: string;
  total: number;
  previousTotal: number;
  handoverCount: number;
  average: number | null;
  segments: ControlSegment[]; // um por turno, na ordem do slot
  series: SeriesPoint[]; // 2N dias contíguos, do mais antigo ao mais novo
};

export type ControlsData = { items: ControlItemMetric[]; totalItems: number };

export type StockLastCount = {
  quantity: number;
  unit: string;
  operationalDate: string;
  shiftName: string;
  handoverId: string;
};

export type StockPoint = { date: string; quantity: number | null };

export type StockItemMetric = {
  itemId: string;
  sectorId: string;
  sectorName: string;
  name: string;
  unit: string;
  last: StockLastCount | null;
  lastBeforePeriod: boolean;
  points: StockPoint[];
};

export type StockData = { items: StockItemMetric[]; totalItems: number };

export type DestinationDelivery = {
  key: string; // uuid | DESTINATION_OTHER
  destinationId: string | null;
  name: string;
  deliveredCount: number;
  averageSeconds: number;
};

export type RequestedItem = {
  itemId: string;
  sectorId: string;
  sectorName: string;
  name: string;
  unit: string;
  quantity: number;
  requestCount: number;
};

export type RequestsData = {
  open: number;
  stale: number;
  deliveredInPeriod: number;
  destinations: DestinationDelivery[];
  totalDestinations: number;
  items: RequestedItem[];
  totalItems: number;
};
