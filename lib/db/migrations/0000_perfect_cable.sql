CREATE TYPE "public"."task_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."translation_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "template_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"template_id" text NOT NULL,
	"template_version_id" text NOT NULL,
	"language_code" text NOT NULL,
	"original_html" text NOT NULL,
	"translated_html" text,
	"original_subject" text,
	"translated_subject" text,
	"status" "translation_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" text NOT NULL,
	"template_name" text NOT NULL,
	"template_version_id" text NOT NULL,
	"source_language" text DEFAULT 'en' NOT NULL,
	"target_languages" text[] NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"total_languages" integer NOT NULL,
	"completed_languages" integer DEFAULT 0 NOT NULL,
	"failed_languages" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "template_translations" ADD CONSTRAINT "template_translations_task_id_translation_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."translation_tasks"("id") ON DELETE cascade ON UPDATE no action;