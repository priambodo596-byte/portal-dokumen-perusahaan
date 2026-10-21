CREATE TABLE IF NOT EXISTS "system_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updatedBy" text NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
