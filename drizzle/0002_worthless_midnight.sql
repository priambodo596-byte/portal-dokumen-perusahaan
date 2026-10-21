CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"bodyHtml" text DEFAULT '' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"headerHtml" text DEFAULT '' NOT NULL,
	"footerHtml" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT 'html' NOT NULL,
	"sourceFileName" text,
	"isDefault" boolean DEFAULT false NOT NULL,
	"uploadedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "templateId" text;--> statement-breakpoint
CREATE INDEX "templates_type_idx" ON "templates" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_default_uq" ON "templates" USING btree ("type") WHERE "isDefault" AND "deletedAt" IS NULL;