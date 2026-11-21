import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Setor da operação (primeiro: ULD). Operador pertence a um setor; admin vê todos.
// Nome único sem diferença de caixa: "Uld" e "ULD" são o mesmo setor.
export const sector = pgTable(
  "sector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sector_name_lower_uq").on(sql`lower(${table.name})`),
  ],
);
