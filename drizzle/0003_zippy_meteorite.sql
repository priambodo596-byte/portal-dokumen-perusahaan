CREATE TABLE "template_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"templateId" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"bodyHtml" text DEFAULT '' NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"headerHtml" text DEFAULT '' NOT NULL,
	"footerHtml" text DEFAULT '' NOT NULL,
	"savedBy" text NOT NULL,
	"savedByName" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_templates_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "template_versions_tpl_idx" ON "template_versions" USING btree ("templateId");--> statement-breakpoint
CREATE UNIQUE INDEX "template_versions_tpl_ver_uq" ON "template_versions" USING btree ("templateId","version");