CREATE TABLE "destination" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"kind" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_kind_valid" CHECK ("item"."kind" in ('control', 'stock'))
);
--> statement-breakpoint
CREATE TABLE "shift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"name" text NOT NULL,
	"starts_at" time NOT NULL,
	"ends_at" time NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_starts_ne_ends" CHECK ("shift"."starts_at" <> "shift"."ends_at")
);
--> statement-breakpoint
ALTER TABLE "sector" DROP CONSTRAINT "sector_name_unique";--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift" ADD CONSTRAINT "shift_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "destination_name_lower_uq" ON "destination" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "item_sector_name_lower_uq" ON "item" USING btree ("sector_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "shift_sector_name_lower_uq" ON "shift" USING btree ("sector_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "sector_name_lower_uq" ON "sector" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_valid" CHECK ("user"."role" in ('admin', 'operator'));--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_role_valid" CHECK ("invite"."role" in ('admin', 'operator'));