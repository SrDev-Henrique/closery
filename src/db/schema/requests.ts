import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { REQUEST_STATUSES } from "@/lib/requestStatuses";

import { user } from "./auth";
import { destination, item } from "./catalog";
import { handover } from "./handovers";
import { sector } from "./sectors";

export { REQUEST_STATUSES, type RequestStatus } from "@/lib/requestStatuses";

// Solicitação do setor. Não se edita depois de criada (D-F4-1): só o status
// muda (sempre com um request_status_event) e entram comentários. Destino é
// exatamente um: o da lista (destination_id) ou o texto do "Outro".
export const request = pgTable(
  "request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    destinationId: uuid("destination_id").references(() => destination.id, {
      onDelete: "restrict",
    }),
    destinationOther: text("destination_other"),
    description: text("description").notNull(),
    status: text("status", { enum: REQUEST_STATUSES })
      .notNull()
      .default("requested"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Quando entrou no status de agora: alimenta "parada" e "dias no status".
    // O domínio grava o `now` injetado aqui e em created_at.
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Passagem em que a solicitação foi criada ("Nova solicitação" do formulário).
    originHandoverId: uuid("origin_handover_id").references(() => handover.id, {
      onDelete: "restrict",
    }),
  },
  (table) => [
    // Quadro e Lista: por setor e status, a mais antiga no status primeiro.
    index("request_sector_status_changed_idx").on(
      table.sectorId,
      table.status,
      table.statusChangedAt,
    ),
    // Tabela e período: por setor e data de criação.
    index("request_sector_created_idx").on(table.sectorId, table.createdAt),
    // Um índice por FK que os de cima não cobrem.
    index("request_destination_id_idx").on(table.destinationId),
    index("request_created_by_idx").on(table.createdBy),
    index("request_origin_handover_id_idx").on(table.originHandoverId),
    check(
      "request_status_valid",
      sql`${table.status} in ('requested', 'in_transit', 'delivered', 'cancelled')`,
    ),
    check(
      "request_destination_exactly_one",
      sql`(${table.destinationId} is null) <> (${table.destinationOther} is null)`,
    ),
    check(
      "request_destination_other_not_blank",
      sql`${table.destinationOther} is null or char_length(btrim(${table.destinationOther}, E' \\t\\r\\n')) > 0`,
    ),
    check(
      "request_description_not_blank",
      sql`char_length(btrim(${table.description}, E' \\t\\r\\n')) > 0`,
    ),
    check(
      "request_status_changed_after_created",
      sql`${table.statusChangedAt} >= ${table.createdAt}`,
    ),
  ],
);

// Item pedido, com nome e unidade congelados na criação ("12 rolos" precisa da
// unidade da época).
export const requestItem = pgTable(
  "request_item",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "restrict" }),
    itemNameSnapshot: text("item_name_snapshot").notNull(),
    itemUnitSnapshot: text("item_unit_snapshot").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.requestId, table.itemId] }),
    index("request_item_item_id_idx").on(table.itemId),
    // O teto (MAX_QUANTITY) fica no domínio: mudar o teto não exige migração.
    check("request_item_quantity_positive", sql`${table.quantity} > 0`),
  ],
);

// Histórico de status: uma linha por mudança (de, para, quem, quando). A
// criação grava NULL → requested. `seq` é a ordem total atribuída pelo banco:
// toda ordenação de eventos é (changed_at, seq), nunca por id (uuid aleatório).
export const requestStatusEvent = pgTable(
  "request_status_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: integer("seq").notNull().generatedAlwaysAsIdentity(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "restrict" }),
    fromStatus: text("from_status", { enum: REQUEST_STATUSES }),
    toStatus: text("to_status", { enum: REQUEST_STATUSES }).notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("request_status_event_request_idx").on(
      table.requestId,
      table.changedAt,
      table.seq,
    ),
    index("request_status_event_changed_by_idx").on(table.changedBy),
    check(
      "request_status_event_from_valid",
      sql`${table.fromStatus} is null or ${table.fromStatus} in ('requested', 'in_transit', 'delivered', 'cancelled')`,
    ),
    check(
      "request_status_event_to_valid",
      sql`${table.toStatus} in ('requested', 'in_transit', 'delivered', 'cancelled')`,
    ),
    check(
      "request_status_event_changes",
      sql`${table.fromStatus} is distinct from ${table.toStatus}`,
    ),
    // from_status nulo só na criação (NULL → requested).
    check(
      "request_status_event_creation_requested",
      sql`${table.fromStatus} is not null or ${table.toStatus} = 'requested'`,
    ),
  ],
);

// Comentário da solicitação. Só recebe INSERT e o UPDATE de deleted_at (apagar).
// O motivo de um cancelamento é um comentário ligado ao evento (status_event_id):
// não se apaga, nem por UPDATE direto (request_comment_reason_not_deleted).
export const requestComment = pgTable(
  "request_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => request.id, { onDelete: "restrict" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    statusEventId: uuid("status_event_id").references(
      () => requestStatusEvent.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    index("request_comment_request_idx").on(table.requestId, table.createdAt),
    index("request_comment_author_id_idx").on(table.authorId),
    // Cobre a FK; vários NULL são permitidos (comentário comum).
    uniqueIndex("request_comment_status_event_uq").on(table.statusEventId),
    check(
      "request_comment_body_not_blank",
      sql`char_length(btrim(${table.body}, E' \\t\\r\\n')) > 0`,
    ),
    check(
      "request_comment_reason_not_deleted",
      sql`${table.statusEventId} is null or ${table.deletedAt} is null`,
    ),
  ],
);
