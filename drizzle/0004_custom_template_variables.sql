CREATE TABLE IF NOT EXISTS "template_variables" (
  "id" text PRIMARY KEY NOT NULL,
  "token" text NOT NULL,
  "label" text NOT NULL,
  "group" text DEFAULT 'Variabel Kustom' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "sampleValue" text DEFAULT '' NOT NULL,
  "createdBy" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "template_variables_token_uq" ON "template_variables" ("token") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "template_variables_group_idx" ON "template_variables" ("group");
