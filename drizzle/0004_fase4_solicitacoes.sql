CREATE TABLE "request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"destination_id" uuid,
	"destination_other" text,
	"description" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin_handover_id" uuid,
	CONSTRAINT "request_status_valid" CHECK ("request"."status" in ('requested', 'in_transit', 'delivered', 'cancelled')),
	CONSTRAINT "request_destination_exactly_one" CHECK (("request"."destination_id" is null) <> ("request"."destination_other" is null)),
	CONSTRAINT "request_destination_other_not_blank" CHECK ("request"."destination_other" is null or char_length(btrim("request"."destination_other", E' \t\r\n')) > 0),
	CONSTRAINT "request_description_not_blank" CHECK (char_length(btrim("request"."description", E' \t\r\n')) > 0),
	CONSTRAINT "request_status_changed_after_created" CHECK ("request"."status_changed_at" >= "request"."created_at")
);
--> statement-breakpoint
CREATE TABLE "request_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"status_event_id" uuid,
	CONSTRAINT "request_comment_body_not_blank" CHECK (char_length(btrim("request_comment"."body", E' \t\r\n')) > 0),
	CONSTRAINT "request_comment_reason_not_deleted" CHECK ("request_comment"."status_event_id" is null or "request_comment"."deleted_at" is null)
);
--> statement-breakpoint
CREATE TABLE "request_item" (
	"request_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"item_name_snapshot" text NOT NULL,
	"item_unit_snapshot" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "request_item_request_id_item_id_pk" PRIMARY KEY("request_id","item_id"),
	CONSTRAINT "request_item_quantity_positive" CHECK ("request_item"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "request_status_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "request_status_event_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"request_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "request_status_event_from_valid" CHECK ("request_status_event"."from_status" is null or "request_status_event"."from_status" in ('requested', 'in_transit', 'delivered', 'cancelled')),
	CONSTRAINT "request_status_event_to_valid" CHECK ("request_status_event"."to_status" in ('requested', 'in_transit', 'delivered', 'cancelled')),
	CONSTRAINT "request_status_event_changes" CHECK ("request_status_event"."from_status" is distinct from "request_status_event"."to_status"),
	CONSTRAINT "request_status_event_creation_requested" CHECK ("request_status_event"."from_status" is not null or "request_status_event"."to_status" = 'requested')
);
--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_destination_id_destination_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destination"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request" ADD CONSTRAINT "request_origin_handover_id_handover_id_fk" FOREIGN KEY ("origin_handover_id") REFERENCES "public"."handover"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comment" ADD CONSTRAINT "request_comment_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comment" ADD CONSTRAINT "request_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_comment" ADD CONSTRAINT "request_comment_status_event_id_request_status_event_id_fk" FOREIGN KEY ("status_event_id") REFERENCES "public"."request_status_event"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_item" ADD CONSTRAINT "request_item_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_item" ADD CONSTRAINT "request_item_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_event" ADD CONSTRAINT "request_status_event_request_id_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."request"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_status_event" ADD CONSTRAINT "request_status_event_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_sector_status_changed_idx" ON "request" USING btree ("sector_id","status","status_changed_at");--> statement-breakpoint
CREATE INDEX "request_sector_created_idx" ON "request" USING btree ("sector_id","created_at");--> statement-breakpoint
CREATE INDEX "request_destination_id_idx" ON "request" USING btree ("destination_id");--> statement-breakpoint
CREATE INDEX "request_created_by_idx" ON "request" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "request_origin_handover_id_idx" ON "request" USING btree ("origin_handover_id");--> statement-breakpoint
CREATE INDEX "request_comment_request_idx" ON "request_comment" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "request_comment_author_id_idx" ON "request_comment" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "request_comment_status_event_uq" ON "request_comment" USING btree ("status_event_id");--> statement-breakpoint
CREATE INDEX "request_item_item_id_idx" ON "request_item" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "request_status_event_request_idx" ON "request_status_event" USING btree ("request_id","changed_at","seq");--> statement-breakpoint
CREATE INDEX "request_status_event_changed_by_idx" ON "request_status_event" USING btree ("changed_by");