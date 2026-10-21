CREATE TABLE "document_files" (
	"id" text PRIMARY KEY NOT NULL,
	"documentId" text NOT NULL,
	"kind" text NOT NULL,
	"fileName" text NOT NULL,
	"mimeType" text NOT NULL,
	"size" integer NOT NULL,
	"version" integer,
	"content" "bytea" NOT NULL,
	"uploadedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "docx_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"fileName" text NOT NULL,
	"size" integer NOT NULL,
	"content" "bytea" NOT NULL,
	"uploadedBy" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_documentId_documents_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_files_doc_idx" ON "document_files" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "docx_templates_type_idx" ON "docx_templates" USING btree ("type");