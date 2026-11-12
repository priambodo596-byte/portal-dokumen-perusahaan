CREATE TABLE "standard_template_files" (
	"code" text PRIMARY KEY NOT NULL,
	"fileName" text NOT NULL,
	"mimeType" text DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' NOT NULL,
	"size" integer NOT NULL,
	"sha256" text NOT NULL,
	"content" "bytea" NOT NULL,
	"uploadedBy" text NOT NULL,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "standard_template_files_uploaded_idx" ON "standard_template_files" USING btree ("updatedAt");
