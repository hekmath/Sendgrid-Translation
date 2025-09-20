import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';

// Enums
export const taskStatusEnum = pgEnum('task_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const translationStatusEnum = pgEnum('translation_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// Translation Tasks Table
export const translationTasks = pgTable('translation_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: text('template_id').notNull(),
  templateName: text('template_name').notNull(),
  templateVersionId: text('template_version_id').notNull(),
  sourceLanguage: text('source_language').notNull().default('en'),
  targetLanguages: text('target_languages').array().notNull(),
  status: taskStatusEnum('status').notNull().default('pending'),
  totalLanguages: integer('total_languages').notNull(),
  completedLanguages: integer('completed_languages').notNull().default(0),
  failedLanguages: integer('failed_languages').notNull().default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Template Translations Table
export const templateTranslations = pgTable('template_translations', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id')
    .references(() => translationTasks.id, { onDelete: 'cascade' })
    .notNull(),
  templateId: text('template_id').notNull(),
  templateVersionId: text('template_version_id').notNull(),
  languageCode: text('language_code').notNull(),
  originalHtml: text('original_html').notNull(),
  translatedHtml: text('translated_html'),
  originalSubject: text('original_subject'),
  translatedSubject: text('translated_subject'),
  status: translationStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const translationTasksRelations = relations(
  translationTasks,
  ({ many }) => ({
    translations: many(templateTranslations),
  })
);

export const templateTranslationsRelations = relations(
  templateTranslations,
  ({ one }) => ({
    task: one(translationTasks, {
      fields: [templateTranslations.taskId],
      references: [translationTasks.id],
    }),
  })
);

// Zod Schemas for validation
export const insertTranslationTaskSchema = createInsertSchema(translationTasks);
export const selectTranslationTaskSchema = createSelectSchema(translationTasks);
export const insertTemplateTranslationSchema =
  createInsertSchema(templateTranslations);
export const selectTemplateTranslationSchema =
  createSelectSchema(templateTranslations);

// TypeScript Types
export type TranslationTask = typeof translationTasks.$inferSelect;
export type InsertTranslationTask = typeof translationTasks.$inferInsert;
export type TemplateTranslation = typeof templateTranslations.$inferSelect;
export type InsertTemplateTranslation =
  typeof templateTranslations.$inferInsert;
