import type { RequestStatus } from "@/lib/requestStatuses";

import type { RequestCapabilities } from "./access";

// Tipos compartilhados das solicitações. Sem I/O: o cliente também importa daqui.
export type { RequestStatus };
export type BoardStatus = Exclude<RequestStatus, "cancelled">;
export type OpenStatus = "requested" | "in_transit";

export type DestinationChoice = { id: string; name: string };
export type FilterDestination = DestinationChoice & { active: boolean };
export type StockItemChoice = { id: string; name: string; unit: string };
export type PersonChoice = { id: string; name: string };
// defaultDestinationId null = "Outro".
export type SectorFormChoices = {
  stockItems: StockItemChoice[];
  defaultDestinationId: string | null;
};
export type RequestFormChoices = {
  destinations: DestinationChoice[];
  bySector: Record<string, SectorFormChoices>;
};

export type RequestItemInput = { itemId: string; quantity: number };
export type RequestDestinationInput =
  | { kind: "list"; destinationId: string }
  | { kind: "other"; text: string };

// Linha do Quadro, da Lista e da Tabela (tudo calculado no SQL).
export type RequestListItem = {
  id: string;
  sectorId: string;
  sectorName: string;
  description: string;
  destinationName: string; // destination.name ou o texto do "Outro"
  destinationIsOther: boolean;
  status: RequestStatus;
  createdByName: string;
  createdAt: Date;
  statusChangedAt: Date;
  daysInStatus: number;
  stale: boolean;
  itemCount: number;
  commentCount: number; // sem os apagados
};
export type RequestCardView = RequestListItem & { pending: boolean }; // pending = movimento em voo
export type RequestGroup = {
  status: RequestStatus;
  total: number;
  limit: number;
  rows: RequestListItem[];
};
export type RequestGroupView = Omit<RequestGroup, "rows"> & {
  rows: RequestCardView[];
};
export type RequestGroups = Record<RequestStatus, RequestGroup>;

// Snapshots da criação.
export type RequestItemLine = {
  itemId: string;
  name: string;
  unit: string;
  quantity: number;
};
export type OpenRequestSummary = {
  id: string;
  description: string;
  destinationName: string;
  status: OpenStatus;
  daysInStatus: number;
  stale: boolean;
};
export type OpenRequestsNow = {
  rows: OpenRequestSummary[];
  total: number;
  staleCount: number;
};
// status, daysInStatus e stale = no instante da entrega.
export type RequestAtDelivery = OpenRequestSummary & {
  statusNow: RequestStatus;
};
export type OpenRequestsAtDelivery = {
  deliveredAt: Date;
  rows: RequestAtDelivery[];
  total: number;
  staleCount: number;
};
export type HomeRequests = {
  openCount: number;
  staleCount: number;
  stale: OpenRequestSummary[];
};

export type RequestTimelineKind =
  | "created"
  | "moved"
  | "cancelled"
  | "reopened";
export type RequestTimelineEntry = {
  id: string;
  kind: RequestTimelineKind;
  from: RequestStatus | null;
  to: RequestStatus;
  byName: string;
  at: Date;
  reason: string | null;
};
export type RequestComment = {
  id: string;
  authorName: string;
  body: string;
  createdAt: Date;
  isCancelReason: boolean;
  canDelete: boolean;
};
// rows = os últimos `limit`, em ordem cronológica.
export type RequestCommentsPage = {
  rows: RequestComment[];
  total: number;
  hasEarlier: boolean;
  limit: number;
};
// shift_name_snapshot ?? nome vivo.
export type RequestOrigin = {
  handoverId: string;
  shiftName: string;
  operationalDate: string;
};
export type RequestDetailView = {
  id: string;
  sectorId: string;
  sectorName: string;
  sectorActive: boolean;
  description: string;
  destinationName: string;
  destinationIsOther: boolean;
  status: RequestStatus;
  createdByName: string;
  createdAt: Date;
  statusChangedAt: Date;
  daysInStatus: number;
  stale: boolean;
  origin: RequestOrigin | null;
  items: RequestItemLine[]; // ordem do item (sort_order, id)
  timeline: RequestTimelineEntry[]; // os últimos TIMELINE_LIMIT, em ordem changed_at asc, seq asc
  comments: RequestCommentsPage;
  capabilities: RequestCapabilities;
};
