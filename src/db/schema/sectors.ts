import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Setor da operação (primeiro: ULD). Operador pertence a um setor; admin vê todos.
export const sector = pgTable("sector", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
