ALTER TABLE "template_translations" ADD COLUMN "retranslate_reason" text;--> statement-breakpoint
ALTER TABLE "template_translations" ADD COLUMN "retranslate_attempts" integer DEFAULT 0 NOT NULL;