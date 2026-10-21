CREATE TABLE IF NOT EXISTS "vendors" (
  "id" text PRIMARY KEY NOT NULL,
  "vendorCode" text NOT NULL,
  "name" text NOT NULL,
  "category" text DEFAULT 'Lainnya' NOT NULL,
  "npwp" text,
  "address" text,
  "contactPerson" text,
  "email" text,
  "phone" text,
  "bankName" text,
  "bankAccount" text,
  "bankAccountName" text,
  "status" text DEFAULT 'active' NOT NULL,
  "notes" text,
  "createdBy" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "deletedAt" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_code_uq" ON "vendors" ("vendorCode") WHERE "deletedAt" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendors_npwp_uq" ON "vendors" ("npwp") WHERE "npwp" IS NOT NULL AND "deletedAt" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_name_idx" ON "vendors" ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_status_idx" ON "vendors" ("status");
