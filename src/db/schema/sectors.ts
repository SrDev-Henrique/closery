import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { SECTOR_COLORS } from "@/features/sectors/colors";

// Setor da operação (primeiro: ULD). Operador pertence a um setor; admin vê todos.
// Nome único sem diferença de caixa: "Uld" e "ULD" são o mesmo setor.
// `color` é uma chave da paleta fechada (D-V3): a cor é do setor e só muda pela tela
// Setores; nunca é derivada da ordem da lista. Sem valor padrão de propósito: um insert
// sem cor tem que falhar (a tela sugere uma cor, o banco não adivinha).
export const sector = pgTable(
  "sector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    color: text("color", { enum: SECTOR_COLORS }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sector_name_lower_uq").on(sql`lower(${table.name})`),
    check(
      "sector_color_valid",
      sql`${table.color} in ('lilac', 'peach', 'sky', 'green', 'pink')`,
    ),
  ],
);
