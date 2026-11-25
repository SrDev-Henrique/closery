import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { item as itemTable, shift as shiftTable } from "@/db/schema/catalog";
import {
  type HandoverStatus,
  handover,
  handoverItem,
} from "@/db/schema/handovers";
import {
  type RequestStatus,
  request,
  requestItem,
  requestStatusEvent,
} from "@/db/schema/requests";
import { fromDbTime } from "@/features/admin/timeOfDay";
import type { Authz } from "@/features/authz/authz";
import type {
  DateRange,
  PassagesData,
  SegmentSlot,
} from "@/features/dashboard/types";
import { correctHandover } from "@/features/handovers/correction";
import type { HistoryPeriodRange } from "@/features/handovers/historyFilters";
import { addDays, saoPauloParts } from "@/features/handovers/saoPaulo";
import { hasShiftEnded, shiftEnd } from "@/features/handovers/shiftSuggestion";
import type { ItemKind } from "@/lib/itemKinds";
import { spDate } from "./clock";
import type { TestDb } from "./db";
import {
  deactivateSector,
  insertDestination,
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertRequest,
  insertRequestEvent,
  insertRequestItem,
  insertSector,
  insertShift,
  insertUser,
} from "./fixtures";

// O cenário do critério de pronto (spec §12) e os leitores crus + oráculos
// que provam os números do dashboard sem usar o SQL do dashboard.

export type WorldHandoverKey =
  | "A10M"
  | "A12N"
  | "C10D"
  | "14M"
  | "14T"
  | "15M"
  | "15A"
  | "15T"
  | "16M"
  | "17T"
  | "19M"
  | "19N"
  | "20M"
  | "20T"
  | "C16D"
  | "C18D"
  | "P17";
export type WorldRequestKey =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10"
  | "R11"
  | "R12";

export type DashboardWorld = {
  now: Date;
  today: string;
  period: HistoryPeriodRange;
  previous: DateRange;
  uld: { id: string; name: string };
  camara: { id: string; name: string };
  inactive: { id: string; name: string };
  shifts: {
    morning: string;
    afternoon: string;
    night: string;
    retired: string;
    camaraDay: string;
    parado: string;
  };
  items: {
    net: string;
    strap: string;
    stretch: string;
    oldStrap: string;
    uldSeal: string;
    film: string;
    seal: string;
    thermalBox: string;
    tape: string;
  };
  people: {
    ana: Authz;
    bia: Authz;
    cris: Authz;
    duda: Authz;
    admin: Authz;
  };
  handovers: Readonly<Record<WorldHandoverKey, string>>;
  requests: Readonly<Record<WorldRequestKey, string>>;
  correctedHandoverId: string;
  destinations: { doca: string; inactive: string };
};

const OLD = new Date("2026-01-01T12:00:00.000Z");

const PEOPLE = ["ana", "bia", "cris", "duda", "admin"] as const;
const SECTOR_KEYS = ["uld", "camara", "parado"] as const;
const SHIFT_KEYS = [
  "morning",
  "afternoon",
  "night",
  "retired",
  "camaraDay",
  "parado",
] as const;
const ITEM_KEYS = [
  "net",
  "strap",
  "stretch",
  "oldStrap",
  "uldSeal",
  "film",
  "seal",
  "thermalBox",
  "tape",
] as const;
const HANDOVER_STATUS_KEYS = ["draft", "delivered", "confirmed"] as const;
const REQUEST_STATUS_KEYS = [
  "requested",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

type Who = (typeof PEOPLE)[number];
type Sector = (typeof SECTOR_KEYS)[number];
type ShiftKey = (typeof SHIFT_KEYS)[number];
type ItemKey = (typeof ITEM_KEYS)[number];
type At = readonly [date: string, time: string];
type Lines = readonly (readonly [ItemKey, number])[];

// Texto → valor, recusando o que não é uma das opções (nunca um cast).
function pick<T extends string>(options: readonly T[], value: string): T {
  const found = options.find((option) => option === value);
  if (found === undefined) throw new Error(`mundo: valor inválido "${value}"`);
  return found;
}

// "2026-11-14T14:05" → ["2026-11-14", "14:05"]
function parseAt(token: string): At {
  const [date, time] = token.split("T");
  if (date === undefined || time === undefined) {
    throw new Error(`mundo: instante inválido "${token}"`);
  }
  return [date, time];
}

// "net=3,strap=5" → [["net", 3], ["strap", 5]]; "-" → []
function parseLines(token: string): Lines {
  if (token === "-") return [];
  return token.split(",").map((part): readonly [ItemKey, number] => {
    const [key, quantity] = part.split("=");
    return [pick(ITEM_KEYS, key ?? ""), Number(quantity)];
  });
}

type HandoverSpec = {
  key: WorldHandoverKey;
  sector: Sector;
  shift: ShiftKey;
  date: string;
  status: HandoverStatus;
  delivered: { at: At; by: Who } | null;
  confirmed: { at: At; by: Who } | null;
  lines: Lines;
};

// A tabela de passagens do plano (Fase 5, "O mundo"), uma por linha:
// chave setor turno dia status entrega(instante/quem) confirmação itens.
// As quantidades de 17T já são as de ANTES da correção (Rede 5).
const HANDOVER_TABLE = `
A10M  uld    morning   2026-11-10 confirmed 2026-11-10T14:05/ana  2026-11-10T14:20/bia   net=4,strap=6,stretch=9
A12N  uld    night     2026-11-12 confirmed 2026-11-13T06:05/bia  2026-11-13T06:20/ana   net=2,strap=3,stretch=7
C10D  camara camaraDay 2026-11-10 confirmed 2026-11-10T19:05/cris 2026-11-10T19:20/admin seal=5,thermalBox=4
14M   uld    morning   2026-11-14 confirmed 2026-11-14T14:05/ana  2026-11-14T14:20/bia   net=3,strap=5,stretch=10
14T   uld    afternoon 2026-11-14 confirmed 2026-11-14T22:05/bia  2026-11-14T22:20/ana   net=2,strap=4,stretch=9
15M   uld    morning   2026-11-15 delivered 2026-11-15T14:05/ana  -                      net=4,strap=6,stretch=8,oldStrap=2
15A   uld    retired   2026-11-15 confirmed 2026-11-15T18:05/bia  2026-11-15T18:20/ana   net=1,strap=2,stretch=7,oldStrap=1
15T   uld    afternoon 2026-11-15 draft     -                     -                      -
16M   uld    morning   2026-11-16 confirmed 2026-11-16T14:05/ana  2026-11-16T14:20/bia   net=5,strap=3,stretch=6
17T   uld    afternoon 2026-11-17 confirmed 2026-11-17T22:05/bia  2026-11-17T22:20/ana   net=5,strap=4,stretch=5
19M   uld    morning   2026-11-19 delivered 2026-11-20T06:30/ana  -                      net=2,strap=2,stretch=4
19N   uld    night     2026-11-19 confirmed 2026-11-20T06:05/bia  2026-11-20T06:20/ana   net=1,strap=3,stretch=3
20M   uld    morning   2026-11-20 confirmed 2026-11-20T13:55/ana  2026-11-20T14:10/bia   net=6,strap=5,stretch=2
20T   uld    afternoon 2026-11-20 delivered 2026-11-20T14:50/bia  -                      net=3,strap=2,stretch=12
C16D  camara camaraDay 2026-11-16 confirmed 2026-11-16T19:05/cris 2026-11-16T19:20/admin seal=2
C18D  camara camaraDay 2026-11-18 delivered 2026-11-18T19:05/cris -                      seal=4
P17   parado parado    2026-11-17 confirmed 2026-11-17T17:05/duda 2026-11-17T17:20/admin tape=3
`;

const HANDOVER_KEYS: readonly WorldHandoverKey[] = [
  "A10M",
  "A12N",
  "C10D",
  "14M",
  "14T",
  "15M",
  "15A",
  "15T",
  "16M",
  "17T",
  "19M",
  "19N",
  "20M",
  "20T",
  "C16D",
  "C18D",
  "P17",
];

// "2026-11-14T14:05/ana" → { at, by }; "-" → null
function parseWho(token: string): { at: At; by: Who } | null {
  if (token === "-") return null;
  const [instant, who] = token.split("/");
  return { at: parseAt(instant ?? ""), by: pick(PEOPLE, who ?? "") };
}

function rowsOf(table: string): string[][] {
  return table
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/));
}

const HANDOVER_SPECS: readonly HandoverSpec[] = rowsOf(HANDOVER_TABLE).map(
  (cells): HandoverSpec => {
    const [key, sector, shift, date, status, delivered, confirmed, lines] =
      cells;
    return {
      key: pick(HANDOVER_KEYS, key ?? ""),
      sector: pick(SECTOR_KEYS, sector ?? ""),
      shift: pick(SHIFT_KEYS, shift ?? ""),
      date: date ?? "",
      status: pick(HANDOVER_STATUS_KEYS, status ?? ""),
      delivered: parseWho(delivered ?? "-"),
      confirmed: parseWho(confirmed ?? "-"),
      lines: parseLines(lines ?? "-"),
    };
  },
);

type RequestSpec = {
  key: WorldRequestKey;
  sector: Sector;
  createdAt: At;
  destination: "doca" | "inactive" | { other: string };
  events: readonly (readonly [RequestStatus, At])[];
  items: Lines;
};

// A tabela de solicitações do plano, uma por linha: chave setor criação
// destino eventos(status@instante) itens. Todas começam com o evento
// "→ solicitada" na criação; os eventos abaixo vêm depois dela.
const REQUEST_TABLE = `
R1  uld    2026-11-16T09:00 doca                    in_transit@2026-11-16T10:00,delivered@2026-11-16T11:00                        net=2
R2  uld    2026-11-12T08:00 doca                    delivered@2026-11-14T12:00                                                    strap=5
R3  uld    2026-11-15T08:00 doca                    delivered@2026-11-15T09:00,in_transit@2026-11-17T10:00,delivered@2026-11-18T10:00 stretch=3
R4  uld    2026-11-17T08:00 other=Pátio_externo     delivered@2026-11-17T08:30,cancelled@2026-11-17T12:00                         net=1
R5  uld    2026-11-12T08:00 doca                    delivered@2026-11-13T08:00,in_transit@2026-11-14T09:00,delivered@2026-11-15T09:00 -
R6  uld    2026-11-18T08:00 inactive                delivered@2026-11-18T14:00                                                    strap=2
R7  uld    2026-11-16T14:00 doca                    -                                                                             stretch=2
R8  uld    2026-11-19T08:00 doca                    in_transit@2026-11-19T09:00                                                   net=4
R9  uld    2026-11-17T15:00 doca                    -                                                                             -
R10 uld    2026-11-18T10:00 doca                    cancelled@2026-11-18T11:00                                                    strap=10
R11 camara 2026-11-19T10:00 doca                    delivered@2026-11-19T10:35                                                    seal=3
R12 parado 2026-11-17T08:00 doca                    delivered@2026-11-17T09:00                                                    tape=1
`;

const REQUEST_KEYS: readonly WorldRequestKey[] = [
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
  "R10",
  "R11",
  "R12",
];

function parseDestination(token: string): RequestSpec["destination"] {
  if (token.startsWith("other=")) {
    return { other: token.slice("other=".length).replaceAll("_", " ") };
  }
  return pick<"doca" | "inactive">(["doca", "inactive"], token);
}

function parseEvents(token: string): RequestSpec["events"] {
  if (token === "-") return [];
  return token.split(",").map((part): readonly [RequestStatus, At] => {
    const [status, instant] = part.split("@");
    return [pick(REQUEST_STATUS_KEYS, status ?? ""), parseAt(instant ?? "")];
  });
}

const REQUEST_SPECS: readonly RequestSpec[] = rowsOf(REQUEST_TABLE).map(
  (cells): RequestSpec => {
    const [key, sector, createdAt, destination, events, items] = cells;
    return {
      key: pick(REQUEST_KEYS, key ?? ""),
      sector: pick(SECTOR_KEYS, sector ?? ""),
      createdAt: parseAt(createdAt ?? ""),
      destination: parseDestination(destination ?? ""),
      events: parseEvents(events ?? "-"),
      items: parseLines(items ?? "-"),
    };
  },
);

function at(value: At): Date {
  return spDate(value[0], value[1]);
}

export async function seedDashboardWorld(db: TestDb): Promise<DashboardWorld> {
  const now = spDate("2026-11-20", "15:00");
  const uld = await insertSector(db, "ULD Teste");
  const camara = await insertSector(db, "Câmara Teste");
  const inactive = await insertSector(db, "Setor Parado");
  const sectorIds: Record<Sector, string> = {
    uld: uld.id,
    camara: camara.id,
    parado: inactive.id,
  };

  const operatorOf = async (name: string, sectorId: string): Promise<Authz> => {
    const created = await insertUser(db, { role: "operator", sectorId, name });
    return {
      userId: created.id,
      name,
      email: `${created.id}@example.test`,
      role: "operator",
      sectorId,
    };
  };
  const adminUser = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const people: DashboardWorld["people"] = {
    ana: await operatorOf("Ana Teste", uld.id),
    bia: await operatorOf("Bia Teste", uld.id),
    cris: await operatorOf("Cris Teste", camara.id),
    duda: await operatorOf("Duda Teste", inactive.id),
    admin: {
      userId: adminUser.id,
      name: "Admin Teste",
      email: `${adminUser.id}@example.test`,
      role: "admin",
      sectorId: null,
    },
  };

  const shiftOf = async (
    sectorId: string,
    name: string,
    startsAt: string,
    endsAt: string,
    sortOrder: number,
    active = true,
  ): Promise<string> =>
    (
      await insertShift(db, {
        sectorId,
        name,
        startsAt,
        endsAt,
        sortOrder,
        active,
        createdAt: OLD,
      })
    ).id;
  const shifts: DashboardWorld["shifts"] = {
    morning: await shiftOf(uld.id, "Manhã", "06:00", "14:00", 1),
    afternoon: await shiftOf(uld.id, "Tarde", "14:00", "22:00", 2),
    night: await shiftOf(uld.id, "Noite", "22:00", "06:00", 3),
    retired: await shiftOf(uld.id, "Turno Antigo", "10:00", "18:00", 0, false),
    camaraDay: await shiftOf(camara.id, "Dia", "07:00", "19:00", 1),
    parado: await shiftOf(inactive.id, "Único", "08:00", "17:00", 1),
  };

  const lateItem = spDate("2026-11-20", "14:55");
  const itemOf = async (
    sectorId: string,
    name: string,
    unit: string,
    kind: ItemKind,
    sortOrder: number,
    options: { active?: boolean; createdAt?: Date } = {},
  ): Promise<string> => {
    const created = await insertItem(db, {
      sectorId,
      name,
      unit,
      kind,
      sortOrder,
      active: options.active ?? true,
    });
    await db
      .update(itemTable)
      .set({ createdAt: options.createdAt ?? OLD })
      .where(eq(itemTable.id, created.id));
    return created.id;
  };
  const items: DashboardWorld["items"] = {
    net: await itemOf(uld.id, "Rede de proteção", "rede", "control", 1),
    strap: await itemOf(uld.id, "Cinta", "peça", "control", 2),
    stretch: await itemOf(uld.id, "Stretch", "rolo", "stock", 3),
    oldStrap: await itemOf(uld.id, "Cinta antiga", "peça", "control", 4, {
      active: false,
    }),
    uldSeal: await itemOf(uld.id, "Lacre ULD", "unidade", "control", 5, {
      createdAt: lateItem,
    }),
    film: await itemOf(uld.id, "Filme", "rolo", "stock", 6, {
      createdAt: lateItem,
    }),
    seal: await itemOf(camara.id, "Lacre", "unidade", "control", 1),
    thermalBox: await itemOf(camara.id, "Caixa térmica", "caixa", "stock", 2),
    tape: await itemOf(inactive.id, "Fita", "rolo", "control", 1),
  };

  const shiftNames: Record<ShiftKey, string> = {
    morning: "Manhã",
    afternoon: "Tarde",
    night: "Noite",
    retired: "Turno Antigo",
    camaraDay: "Dia",
    parado: "Único",
  };
  const handovers: Partial<Record<WorldHandoverKey, string>> = {};
  for (const spec of HANDOVER_SPECS) {
    const delivered = spec.delivered;
    const confirmed = spec.confirmed;
    const created = await insertHandover(db, {
      sectorId: sectorIds[spec.sector],
      shiftId: shifts[spec.shift],
      operationalDate: spec.date,
      status: spec.status,
      ...(delivered
        ? {
            shiftNameSnapshot: shiftNames[spec.shift],
            deliveredBy: people[delivered.by].userId,
            deliveredAt: at(delivered.at),
          }
        : { updatedBy: people.ana.userId }),
      ...(confirmed
        ? {
            confirmedBy: people[confirmed.by].userId,
            confirmedAt: at(confirmed.at),
          }
        : {}),
    });
    handovers[spec.key] = created.id;
    for (const [itemKey, quantity] of spec.lines) {
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: items[itemKey],
        quantity,
        snapshot: true,
      });
    }
  }

  // A correção é a operação real (spec §12): Rede de proteção 5 → 8 na 17T.
  const corrected = handovers["17T"];
  if (corrected === undefined) throw new Error("mundo: falta a passagem 17T");
  const correction = await correctHandover(
    db,
    people.admin,
    {
      id: corrected,
      reason: "Contagem conferida no depósito",
      occurrencesText: "",
      nextShiftText: "",
      items: [
        { itemId: items.net, quantity: 8, note: "" },
        { itemId: items.strap, quantity: 4, note: "" },
        { itemId: items.stretch, quantity: 5, note: "" },
      ],
    },
    spDate("2026-11-18", "09:00"),
  );
  if (!correction.ok) throw new Error("mundo: a correção da 17T falhou");

  const doca = await insertDestination(db, { name: "Doca 3" });
  const docaAntiga = await insertDestination(db, {
    name: "Doca Antiga",
    active: false,
  });
  const requests: Partial<Record<WorldRequestKey, string>> = {};
  for (const spec of REQUEST_SPECS) {
    const last = spec.events.at(-1);
    const author =
      spec.sector === "parado"
        ? people.duda
        : spec.sector === "camara"
          ? people.cris
          : people.ana;
    const destination =
      spec.destination === "doca"
        ? { destinationId: doca.id }
        : spec.destination === "inactive"
          ? { destinationId: docaAntiga.id }
          : { destinationOther: spec.destination.other };
    const created = await insertRequest(db, {
      sectorId: sectorIds[spec.sector],
      createdBy: author.userId,
      ...destination,
      status: last ? last[0] : "requested",
      createdAt: at(spec.createdAt),
      statusChangedAt: at(last ? last[1] : spec.createdAt),
      events: false,
    });
    requests[spec.key] = created.id;
    await insertRequestEvent(db, {
      requestId: created.id,
      fromStatus: null,
      toStatus: "requested",
      changedBy: author.userId,
      changedAt: at(spec.createdAt),
    });
    let from: RequestStatus = "requested";
    for (const [toStatus, when] of spec.events) {
      await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: from,
        toStatus,
        changedBy: author.userId,
        changedAt: at(when),
      });
      from = toStatus;
    }
    for (const [itemKey, quantity] of spec.items) {
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: items[itemKey],
        quantity,
      });
    }
  }

  await deactivateSector(db, inactive.id);

  return {
    now,
    today: "2026-11-20",
    period: { period: "7", from: "2026-11-14", to: "2026-11-20" },
    previous: { from: "2026-11-07", to: "2026-11-13" },
    uld,
    camara,
    inactive,
    shifts,
    items,
    people,
    handovers: completeKeys(
      handovers,
      HANDOVER_SPECS.map((s) => s.key),
    ),
    requests: completeKeys(
      requests,
      REQUEST_SPECS.map((s) => s.key),
    ),
    correctedHandoverId: corrected,
    destinations: { doca: doca.id, inactive: docaAntiga.id },
  };
}

// Prova (em tempo de execução) que todas as chaves do mapa foram criadas.
function completeKeys<K extends string>(
  partial: Partial<Record<K, string>>,
  keys: readonly K[],
): Record<K, string> {
  const entries = keys.map((key): [K, string] => {
    const id = partial[key];
    if (id === undefined) throw new Error(`mundo: falta ${key}`);
    return [key, id];
  });
  // Único cast permitido (exceção documentada nas Global Constraints): o
  // TypeScript não prova que `Object.fromEntries` tem todas as chaves K, mas o
  // laço acima acabou de verificar, em tempo de execução, cada uma delas.
  return Object.fromEntries(entries) as Record<K, string>;
}

// ---------------------------------------------------------------------------
// Leitores crus: SELECT simples, sem agregação, sem `min`, sem historySource
// nem fragmento do domínio. O oráculo calcula tudo em JS sobre eles.
// ---------------------------------------------------------------------------

export type RawShift = {
  id: string;
  sectorId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
};
export type RawHandover = {
  id: string;
  sectorId: string;
  shiftId: string;
  operationalDate: string;
  status: HandoverStatus;
  deliveredAt: Date | null;
  corrected: boolean;
};
export type RawDeliveredItem = {
  itemId: string;
  handoverId: string;
  shiftId: string;
  operationalDate: string;
  quantity: number;
};
export type RawRequest = {
  id: string;
  destinationId: string | null;
  createdAt: Date;
  status: RequestStatus;
  events: { toStatus: RequestStatus; changedAt: Date }[];
  items: { itemId: string; name: string; unit: string; quantity: number }[];
};

export async function rawShifts(
  db: TestDb,
  sectorIds: readonly string[],
): Promise<RawShift[]> {
  if (sectorIds.length === 0) return [];
  const rows = await db
    .select({
      id: shiftTable.id,
      sectorId: shiftTable.sectorId,
      name: shiftTable.name,
      startsAt: shiftTable.startsAt,
      endsAt: shiftTable.endsAt,
      active: shiftTable.active,
      sortOrder: shiftTable.sortOrder,
      createdAt: shiftTable.createdAt,
    })
    .from(shiftTable)
    .where(inArray(shiftTable.sectorId, [...sectorIds]));
  return rows.map((row) => ({
    ...row,
    startsAt: fromDbTime(row.startsAt),
    endsAt: fromDbTime(row.endsAt),
  }));
}

export async function rawHandovers(
  db: TestDb,
  sectorIds: readonly string[],
): Promise<RawHandover[]> {
  if (sectorIds.length === 0) return [];
  return db
    .select({
      id: handover.id,
      sectorId: handover.sectorId,
      shiftId: handover.shiftId,
      operationalDate: handover.operationalDate,
      status: handover.status,
      deliveredAt: handover.deliveredAt,
      corrected: sql<boolean>`exists (select 1 from handover_correction c where c.handover_id = "handover"."id")`,
    })
    .from(handover)
    .where(inArray(handover.sectorId, [...sectorIds]));
}

export async function rawDeliveredItems(
  db: TestDb,
  input: {
    sectorIds: readonly string[];
    range: DateRange;
    kind: ItemKind;
  },
): Promise<RawDeliveredItem[]> {
  if (input.sectorIds.length === 0) return [];
  return db
    .select({
      itemId: handoverItem.itemId,
      handoverId: handoverItem.handoverId,
      shiftId: handover.shiftId,
      operationalDate: handover.operationalDate,
      quantity: handoverItem.quantity,
    })
    .from(handoverItem)
    .innerJoin(handover, eq(handover.id, handoverItem.handoverId))
    .where(
      and(
        inArray(handover.sectorId, [...input.sectorIds]),
        inArray(handover.status, ["delivered", "confirmed"]),
        gte(handover.operationalDate, input.range.from),
        lte(handover.operationalDate, input.range.to),
        eq(handoverItem.itemKindSnapshot, input.kind),
      ),
    );
}

export async function rawRequests(
  db: TestDb,
  sectorIds: readonly string[],
): Promise<RawRequest[]> {
  if (sectorIds.length === 0) return [];
  const rows = await db
    .select({
      id: request.id,
      destinationId: request.destinationId,
      createdAt: request.createdAt,
      status: request.status,
    })
    .from(request)
    .where(inArray(request.sectorId, [...sectorIds]));
  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return [];
  const events = await db
    .select({
      requestId: requestStatusEvent.requestId,
      toStatus: requestStatusEvent.toStatus,
      changedAt: requestStatusEvent.changedAt,
    })
    .from(requestStatusEvent)
    .where(inArray(requestStatusEvent.requestId, ids))
    .orderBy(asc(requestStatusEvent.seq));
  const lines = await db
    .select({
      requestId: requestItem.requestId,
      itemId: requestItem.itemId,
      name: requestItem.itemNameSnapshot,
      unit: requestItem.itemUnitSnapshot,
      quantity: requestItem.quantity,
    })
    .from(requestItem)
    .where(inArray(requestItem.requestId, ids));
  return rows.map((row) => ({
    ...row,
    events: events
      .filter((event) => event.requestId === row.id)
      .map((event) => ({
        toStatus: event.toStatus,
        changedAt: event.changedAt,
      })),
    items: lines
      .filter((line) => line.requestId === row.id)
      .map((line) => ({
        itemId: line.itemId,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
      })),
  }));
}

// ---------------------------------------------------------------------------
// Oráculos: JS puro sobre os leitores crus. As regras estão escritas aqui, não
// importadas do SQL do dashboard.
// ---------------------------------------------------------------------------

function daysOf(range: DateRange): string[] {
  const days: string[] = [];
  for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

const inRange = (day: string, range: DateRange) =>
  day >= range.from && day <= range.to;

const isDelivered = (status: HandoverStatus) =>
  status === "delivered" || status === "confirmed";

// Passagens: pares (turno ativo × dia ≥ dia da criação do turno em São Paulo)
// já encerrados; entregue = delivered/confirmed do período; "aguardando" = a
// entregue mais recente do setor (qualquer data) por (deliveredAt, id).
export function oraclePassages(input: {
  shifts: readonly RawShift[];
  handovers: readonly RawHandover[];
  sectorIds: readonly string[];
  period: DateRange;
  now: Date;
}): PassagesData {
  const inScope = (sectorId: string) => input.sectorIds.includes(sectorId);
  const delivered = input.handovers.filter(
    (h) =>
      inScope(h.sectorId) &&
      isDelivered(h.status) &&
      inRange(h.operationalDate, input.period),
  );

  const latestBySector = new Map<string, RawHandover>();
  for (const h of input.handovers) {
    if (!inScope(h.sectorId) || !isDelivered(h.status) || !h.deliveredAt) {
      continue;
    }
    const best = latestBySector.get(h.sectorId);
    const bestAt = best?.deliveredAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    if (
      best === undefined ||
      h.deliveredAt.getTime() > bestAt ||
      (h.deliveredAt.getTime() === bestAt && h.id > best.id)
    ) {
      latestBySector.set(h.sectorId, h);
    }
  }

  let confirmed = 0;
  let awaiting = 0;
  let unconfirmed = 0;
  for (const h of delivered) {
    if (h.status === "confirmed") confirmed += 1;
    else if (latestBySector.get(h.sectorId)?.id === h.id) awaiting += 1;
    else unconfirmed += 1;
  }

  let expected = 0;
  let missing = 0;
  for (const s of input.shifts) {
    if (!s.active || !inScope(s.sectorId)) continue;
    const created = saoPauloParts(s.createdAt).date;
    for (const day of daysOf(input.period)) {
      if (day < created) continue;
      if (!hasShiftEnded(day, s, input.now)) continue;
      expected += 1;
      const hasDelivery = input.handovers.some(
        (h) =>
          h.sectorId === s.sectorId &&
          h.shiftId === s.id &&
          h.operationalDate === day &&
          isDelivered(h.status),
      );
      if (!hasDelivery) missing += 1;
    }
  }

  return {
    expected,
    delivered: delivered.length,
    confirmed,
    awaiting,
    unconfirmed,
    missing,
    listed: delivered.length + missing,
  };
}

export type OracleControlItem = {
  itemId: string;
  total: number;
  previousTotal: number;
  handoverCount: number;
  average: number | null;
  byShift: Record<string, { total: number; previousTotal: number }>;
  byDay: Record<string, number>;
};

// Controles: `lines` são as linhas de controle de [anterior.from, atual.to]
// (rawDeliveredItems com kind "control"); `itemIds` inclui os itens sem linha.
export function oracleControls(input: {
  lines: readonly RawDeliveredItem[];
  itemIds: readonly string[];
  period: DateRange;
  previous: DateRange;
}): OracleControlItem[] {
  return input.itemIds.map((itemId) => {
    const own = input.lines.filter((line) => line.itemId === itemId);
    const current = own.filter((line) =>
      inRange(line.operationalDate, input.period),
    );
    const before = own.filter((line) =>
      inRange(line.operationalDate, input.previous),
    );
    const sum = (lines: readonly RawDeliveredItem[]) =>
      lines.reduce((acc, line) => acc + line.quantity, 0);
    const total = sum(current);
    const byShift: OracleControlItem["byShift"] = {};
    for (const line of own) {
      const entry = byShift[line.shiftId] ?? { total: 0, previousTotal: 0 };
      if (inRange(line.operationalDate, input.period)) {
        entry.total += line.quantity;
      }
      if (inRange(line.operationalDate, input.previous)) {
        entry.previousTotal += line.quantity;
      }
      byShift[line.shiftId] = entry;
    }
    const byDay: Record<string, number> = {};
    for (const line of own) {
      byDay[line.operationalDate] =
        (byDay[line.operationalDate] ?? 0) + line.quantity;
    }
    return {
      itemId,
      total,
      previousTotal: sum(before),
      handoverCount: current.length,
      average:
        current.length === 0
          ? null
          : Math.round((total / current.length) * 10) / 10,
      byShift,
      byDay,
    };
  });
}

export type OracleStockItem = {
  itemId: string;
  last: {
    quantity: number;
    operationalDate: string;
    shiftId: string;
    handoverId: string;
  } | null;
  lastBeforePeriod: boolean;
  points: { date: string; quantity: number | null }[];
};

// Estoque: `lines` são as contagens de estoque até o fim do período
// (rawDeliveredItems com kind "stock" e `to` = fim do período).
export function oracleStock(input: {
  lines: readonly RawDeliveredItem[];
  handovers: readonly RawHandover[];
  shifts: readonly RawShift[];
  itemIds: readonly string[];
  period: DateRange;
}): OracleStockItem[] {
  const endKey = (line: RawDeliveredItem): string => {
    const shift = input.shifts.find((s) => s.id === line.shiftId);
    if (!shift) throw new Error("oráculo: turno desconhecido");
    const end = shiftEnd(line.operationalDate, shift);
    return `${end.date}T${String(end.minutes).padStart(4, "0")}`;
  };
  const deliveredAt = (line: RawDeliveredItem): number =>
    input.handovers
      .find((h) => h.id === line.handoverId)
      ?.deliveredAt?.getTime() ?? 0;
  // Do mais recente para o mais antigo: dia, fim do turno, entrega, id.
  const newestFirst = (a: RawDeliveredItem, b: RawDeliveredItem): number => {
    if (a.operationalDate !== b.operationalDate) {
      return a.operationalDate < b.operationalDate ? 1 : -1;
    }
    const endA = endKey(a);
    const endB = endKey(b);
    if (endA !== endB) return endA < endB ? 1 : -1;
    if (deliveredAt(a) !== deliveredAt(b)) {
      return deliveredAt(a) < deliveredAt(b) ? 1 : -1;
    }
    return a.handoverId < b.handoverId
      ? 1
      : a.handoverId > b.handoverId
        ? -1
        : 0;
  };

  return input.itemIds.map((itemId) => {
    const own = input.lines
      .filter(
        (line) =>
          line.itemId === itemId && line.operationalDate <= input.period.to,
      )
      .sort(newestFirst);
    const newest = own[0];
    return {
      itemId,
      last: newest
        ? {
            quantity: newest.quantity,
            operationalDate: newest.operationalDate,
            shiftId: newest.shiftId,
            handoverId: newest.handoverId,
          }
        : null,
      lastBeforePeriod: newest
        ? newest.operationalDate < input.period.from
        : false,
      points: daysOf(input.period).map((date) => ({
        date,
        quantity:
          own.find((line) => line.operationalDate === date)?.quantity ?? null,
      })),
    };
  });
}

export type OracleRequests = {
  open: number;
  stale: number;
  deliveredInPeriod: number;
  destinations: Record<
    string,
    { deliveredCount: number; averageSeconds: number }
  >;
  items: Record<string, { quantity: number; requestCount: number }>;
};

const STALE_MS = 72 * 60 * 60 * 1000;

// Solicitações: a 1ª entrega é o menor `changedAt` com toStatus "delivered",
// calculado aqui sobre os eventos crus; o dia é o de São Paulo.
export function oracleRequests(input: {
  requests: readonly RawRequest[];
  now: Date;
  period: DateRange;
}): OracleRequests {
  let open = 0;
  let stale = 0;
  let deliveredInPeriod = 0;
  const groups = new Map<string, { count: number; seconds: number }>();
  const items: OracleRequests["items"] = {};

  for (const r of input.requests) {
    if (r.status === "requested" || r.status === "in_transit") {
      open += 1;
      const lastEvent = r.events.at(-1);
      const changedAt = lastEvent?.changedAt ?? r.createdAt;
      if (input.now.getTime() - changedAt.getTime() > STALE_MS) stale += 1;
    }

    const deliveries = r.events
      .filter((event) => event.toStatus === "delivered")
      .map((event) => event.changedAt.getTime());
    if (deliveries.length > 0) {
      const first = Math.min(...deliveries);
      if (inRange(saoPauloParts(new Date(first)).date, input.period)) {
        deliveredInPeriod += 1;
        const key = r.destinationId ?? "outro";
        const group = groups.get(key) ?? { count: 0, seconds: 0 };
        group.count += 1;
        group.seconds += (first - r.createdAt.getTime()) / 1000;
        groups.set(key, group);
      }
    }

    if (
      r.status !== "cancelled" &&
      inRange(saoPauloParts(r.createdAt).date, input.period)
    ) {
      for (const line of r.items) {
        const entry = items[line.itemId] ?? { quantity: 0, requestCount: 0 };
        entry.quantity += line.quantity;
        entry.requestCount += 1;
        items[line.itemId] = entry;
      }
    }
  }

  const destinations: OracleRequests["destinations"] = {};
  for (const [key, group] of groups) {
    destinations[key] = {
      deliveredCount: group.count,
      averageSeconds: group.seconds / group.count,
    };
  }
  return { open, stale, deliveredInPeriod, destinations, items };
}

export type OracleCsv = {
  rows: number;
  controlItemIds: string[];
  stockItemIds: string[];
  controlSums: Record<string, number>;
};

// CSV: uma linha por linha do histórico (= entregues + sem passagem), uma
// coluna por item que tem linha numa passagem entregue do período.
export function oracleCsv(input: {
  passages: PassagesData;
  controlLines: readonly RawDeliveredItem[];
  stockLines: readonly RawDeliveredItem[];
}): OracleCsv {
  const ids = (lines: readonly RawDeliveredItem[]) =>
    [...new Set(lines.map((line) => line.itemId))].sort();
  const controlSums: Record<string, number> = {};
  for (const line of input.controlLines) {
    controlSums[line.itemId] = (controlSums[line.itemId] ?? 0) + line.quantity;
  }
  return {
    rows: input.passages.listed,
    controlItemIds: ids(input.controlLines),
    stockItemIds: ids(input.stockLines),
    controlSums,
  };
}

// Slot da cor do turno: posição entre TODOS os turnos do setor (ativos
// primeiro, depois sort_order, created_at, id); 1–4 têm cor própria.
export function oracleSlotOf(
  shifts: readonly RawShift[],
  sectorId: string,
  shiftId: string,
): SegmentSlot {
  const ordered = shifts
    .filter((s) => s.sectorId === sectorId)
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.createdAt.getTime() !== b.createdAt.getTime()) {
        return a.createdAt.getTime() - b.createdAt.getTime();
      }
      return a.id < b.id ? -1 : 1;
    });
  const position = ordered.findIndex((s) => s.id === shiftId) + 1;
  if (position === 1) return 1;
  if (position === 2) return 2;
  if (position === 3) return 3;
  if (position === 4) return 4;
  return null;
}
