CREATE TABLE "inquiries" (
	"id" bigserial PRIMARY KEY,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiries_type_check" CHECK ("type" IN ('contact','care_request','application')),
	CONSTRAINT "inquiries_status_check" CHECK ("status" IN ('new','in_progress','done'))
);
--> statement-breakpoint
CREATE INDEX "idx_inq_type" ON "inquiries" ("type");--> statement-breakpoint
CREATE INDEX "idx_inq_status" ON "inquiries" ("status");--> statement-breakpoint
CREATE INDEX "idx_inq_created" ON "inquiries" ("created_at" DESC NULLS LAST);