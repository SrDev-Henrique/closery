import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ITEM_KINDS } from "@/lib/itemKinds";

import { user } from "./auth";
import { item, shift } from "./catalog";
import { sector } from "./sectors";

export const HANDOVER_STATUSES = ["draft", "delivered", "confirmed"] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const CORRECTION_FIELDS = [
  "occurrences_text",
  "next_shift_text",
  "item_quantity",
  "item_note",
] as const;
export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

// Passagem de turno: uma por setor + turno + dia operacional (UNIQUE). O dia
// operacional é `date` e trafega como texto "YYYY-MM-DD" (nunca vira Date).
export const handover = pgTable(
  "handover",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "restrict" }),
    operationalDate: date("operational_date", { mode: "string" }).notNull(),
    status: text("status", { enum: HANDOVER_STATUSES })
      .notNull()
      .default("draft"),
    // Nome do turno no momento da entrega: renomear o turno depois não muda o
    // que foi entregue.
    shiftNameSnapshot: text("shift_name_snapshot"),
    occurrencesText: text("occurrences_text").notNull().default(""),
    nextShiftText: text("next_shift_text").notNull().default(""),
    deliveredBy: text("delivered_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    confirmedBy: text("confirmed_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmationNote: text("confirmation_note"),
    // Quem salvou por último: alimenta "Salvo às HH:mm por {nome}".
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("handover_sector_shift_date_uq").on(
      table.sectorId,
      table.shiftId,
      table.operationalDate,
    ),
    // Histórico: filtra por setor e período.
    index("handover_sector_date_idx").on(table.sectorId, table.operationalDate),
    // Um índice por FK que o UNIQUE acima não cobre.
    index("handover_shift_id_idx").on(table.shiftId),
    index("handover_delivered_by_idx").on(table.deliveredBy),
    index("handover_confirmed_by_idx").on(table.confirmedBy),
    index("handover_updated_by_idx").on(table.updatedBy),
    check(
      "handover_status_valid",
      sql`${table.status} in ('draft', 'delivered', 'confirmed')`,
    ),
    // Quem entregou nunca confirma. Sozinho passa quando delivered_by é NULL
    // (comparação com NULL); handover_state_consistent fecha esse buraco.
    check(
      "handover_confirmer_ne_deliverer",
      sql`${table.confirmedBy} is null or ${table.confirmedBy} <> ${table.deliveredBy}`,
    ),
    check(
      "handover_state_consistent",
      sql`(${table.status} = 'draft' and ${table.deliveredBy} is null and ${table.deliveredAt} is null and ${table.confirmedBy} is null and ${table.confirmedAt} is null) or (${table.status} = 'delivered' and ${table.deliveredBy} is not null and ${table.deliveredAt} is not null and ${table.confirmedBy} is null and ${table.confirmedAt} is null) or (${table.status} = 'confirmed' and ${table.deliveredBy} is not null and ${table.deliveredAt} is not null and ${table.confirmedBy} is not null and ${table.confirmedAt} is not null)`,
    ),
  ],
);

// Contagem de um item na passagem. Os snapshots (nome, unidade, tipo) ficam
// nulos no rascunho e são preenchidos na entrega.
export const handoverItem = pgTable(
  "handover_item",
  {
    handoverId: uuid("handover_id")
      .notNull()
      .references(() => handover.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    note: text("note"),
    itemNameSnapshot: text("item_name_snapshot"),
    itemUnitSnapshot: text("item_unit_snapshot"),
    itemKindSnapshot: text("item_kind_snapshot", { enum: ITEM_KINDS }),
  },
  (table) => [
    primaryKey({ columns: [table.handoverId, table.itemId] }),
    index("handover_item_item_id_idx").on(table.itemId),
    // O teto (MAX_QUANTITY) fica no domínio: mudar o teto não exige migração.
    check("handover_item_quantity_nonneg", sql`${table.quantity} >= 0`),
    check(
      "handover_item_kind_snapshot_valid",
      sql`${table.itemKindSnapshot} is null or ${table.itemKindSnapshot} in ('control', 'stock')`,
    ),
  ],
);

// Rastro de correção depois da confirmação (D13): uma linha por campo
// alterado. Nunca UPDATE nem DELETE.
export const handoverCorrection = pgTable(
  "handover_correction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handoverId: uuid("handover_id")
      .notNull()
      .references(() => handover.id, { onDelete: "restrict" }),
    field: text("field", { enum: CORRECTION_FIELDS }).notNull(),
    itemId: uuid("item_id").references(() => item.id, {
      onDelete: "restrict",
    }),
    oldValue: text("old_value").notNull(),
    newValue: text("new_value").notNull(),
    reason: text("reason").notNull(),
    correctedBy: text("corrected_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    correctedAt: timestamp("corrected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("handover_correction_handover_idx").on(
      table.handoverId,
      table.correctedAt,
    ),
    index("handover_correction_item_id_idx").on(table.itemId),
    index("handover_correction_corrected_by_idx").on(table.correctedBy),
    check(
      "handover_correction_field_valid",
      sql`${table.field} in ('occurrences_text', 'next_shift_text', 'item_quantity', 'item_note')`,
    ),
    // Campo de item exige item_id; campo de texto não pode ter item_id.
    check(
      "handover_correction_item_matches_field",
      sql`(${table.field} in ('item_quantity', 'item_note')) = (${table.itemId} is not null)`,
    ),
    check(
      "handover_correction_reason_not_blank",
      sql`char_length(btrim(${table.reason})) > 0`,
    ),
  ],
);
