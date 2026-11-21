import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ITEM_KINDS } from "@/lib/itemKinds";

import { sector } from "./sectors";

// Item de controle soma no período; item de estoque vale a última contagem.
export { ITEM_KINDS, type ItemKind } from "@/lib/itemKinds";

// Turno do setor. Atravessar a meia-noite é permitido (ends_at < starts_at);
// só início igual ao fim é recusado.
export const shift = pgTable(
  "shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Começa por sector_id: já cobre a FK.
    uniqueIndex("shift_sector_name_lower_uq").on(
      table.sectorId,
      sql`lower(${table.name})`,
    ),
    check("shift_starts_ne_ends", sql`${table.startsAt} <> ${table.endsAt}`),
  ],
);

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    kind: text("kind", { enum: ITEM_KINDS }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("item_sector_name_lower_uq").on(
      table.sectorId,
      sql`lower(${table.name})`,
    ),
    check("item_kind_valid", sql`${table.kind} in ('control', 'stock')`),
  ],
);

// Destino de pedido de material; vale para todos os setores.
export const destination = pgTable(
  "destination",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("destination_name_lower_uq").on(sql`lower(${table.name})`),
  ],
);
