CREATE TABLE "handover" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"operational_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"shift_name_snapshot" text,
	"occurrences_text" text DEFAULT '' NOT NULL,
	"next_shift_text" text DEFAULT '' NOT NULL,
	"delivered_by" text,
	"delivered_at" timestamp with time zone,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"confirmation_note" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handover_status_valid" CHECK ("handover"."status" in ('draft', 'delivered', 'confirmed')),
	CONSTRAINT "handover_confirmer_ne_deliverer" CHECK ("handover"."confirmed_by" is null or "handover"."confirmed_by" <> "handover"."delivered_by"),
	CONSTRAINT "handover_state_consistent" CHECK (("handover"."status" = 'draft' and "handover"."delivered_by" is null and "handover"."delivered_at" is null and "handover"."confirmed_by" is null and "handover"."confirmed_at" is null) or ("handover"."status" = 'delivered' and "handover"."delivered_by" is not null and "handover"."delivered_at" is not null and "handover"."confirmed_by" is null and "handover"."confirmed_at" is null) or ("handover"."status" = 'confirmed' and "handover"."delivered_by" is not null and "handover"."delivered_at" is not null and "handover"."confirmed_by" is not null and "handover"."confirmed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "handover_correction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handover_id" uuid NOT NULL,
	"field" text NOT NULL,
	"item_id" uuid,
	"old_value" text NOT NULL,
	"new_value" text NOT NULL,
	"reason" text NOT NULL,
	"corrected_by" text NOT NULL,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handover_correction_field_valid" CHECK ("handover_correction"."field" in ('occurrences_text', 'next_shift_text', 'item_quantity', 'item_note')),
	CONSTRAINT "handover_correction_item_matches_field" CHECK (("handover_correction"."field" in ('item_quantity', 'item_note')) = ("handover_correction"."item_id" is not null)),
	CONSTRAINT "handover_correction_reason_not_blank" CHECK (char_length(btrim("handover_correction"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "handover_item" (
	"handover_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"note" text,
	"item_name_snapshot" text,
	"item_unit_snapshot" text,
	"item_kind_snapshot" text,
	CONSTRAINT "handover_item_handover_id_item_id_pk" PRIMARY KEY("handover_id","item_id"),
	CONSTRAINT "handover_item_quantity_nonneg" CHECK ("handover_item"."quantity" >= 0),
	CONSTRAINT "handover_item_kind_snapshot_valid" CHECK ("handover_item"."item_kind_snapshot" is null or "handover_item"."item_kind_snapshot" in ('control', 'stock'))
);
--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_shift_id_shift_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shift"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_delivered_by_user_id_fk" FOREIGN KEY ("delivered_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover" ADD CONSTRAINT "handover_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_correction" ADD CONSTRAINT "handover_correction_handover_id_handover_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."handover"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_correction" ADD CONSTRAINT "handover_correction_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_correction" ADD CONSTRAINT "handover_correction_corrected_by_user_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_item" ADD CONSTRAINT "handover_item_handover_id_handover_id_fk" FOREIGN KEY ("handover_id") REFERENCES "public"."handover"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handover_item" ADD CONSTRAINT "handover_item_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "handover_sector_shift_date_uq" ON "handover" USING btree ("sector_id","shift_id","operational_date");--> statement-breakpoint
CREATE INDEX "handover_sector_date_idx" ON "handover" USING btree ("sector_id","operational_date");--> statement-breakpoint
CREATE INDEX "handover_shift_id_idx" ON "handover" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "handover_delivered_by_idx" ON "handover" USING btree ("delivered_by");--> statement-breakpoint
CREATE INDEX "handover_confirmed_by_idx" ON "handover" USING btree ("confirmed_by");--> statement-breakpoint
CREATE INDEX "handover_updated_by_idx" ON "handover" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "handover_correction_handover_idx" ON "handover_correction" USING btree ("handover_id","corrected_at");--> statement-breakpoint
CREATE INDEX "handover_correction_item_id_idx" ON "handover_correction" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "handover_correction_corrected_by_idx" ON "handover_correction" USING btree ("corrected_by");--> statement-breakpoint
CREATE INDEX "handover_item_item_id_idx" ON "handover_item" USING btree ("item_id");