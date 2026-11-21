import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { ROLES } from "@/lib/roles";

import { user } from "./auth";
import { sector } from "./sectors";

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Só o hash SHA-256 do token; o token bruto nunca é gravado.
    tokenHash: text("token_hash").notNull().unique(),
    role: text("role", { enum: ROLES }).notNull(),
    sectorId: uuid("sector_id").references(() => sector.id, {
      onDelete: "restrict",
    }),
    inviteeLabel: text("invitee_label"),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: text("used_by").references(() => user.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invite_sector_id_idx").on(table.sectorId),
    index("invite_invited_by_idx").on(table.invitedBy),
    index("invite_used_by_idx").on(table.usedBy),
    check("invite_role_valid", sql`${table.role} in ('admin', 'operator')`),
    check(
      "invite_operator_needs_sector",
      sql`${table.role} = 'admin' or ${table.sectorId} is not null`,
    ),
  ],
);
