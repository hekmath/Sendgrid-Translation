import { db } from '@/lib/db';
import {
  translationTasks,
  templateTranslations,
  type InsertTranslationTask,
  type InsertTemplateTranslation,
  type TranslationTask,
  type TemplateTranslation,
} from '@/lib/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

export const dbService = {
  translationTasks: {
    async create(data: InsertTranslationTask): Promise<TranslationTask> {
      const [task] = await db.insert(translationTasks).values(data).returning();
      return task;
    },

    async findById(id: string): Promise<TranslationTask | undefined> {
      const [task] = await db
        .select()
        .from(translationTasks)
        .where(eq(translationTasks.id, id));
      return task;
    },

    async findByTemplateId(templateId: string): Promise<TranslationTask[]> {
      return await db
        .select()
        .from(translationTasks)
        .where(eq(translationTasks.templateId, templateId))
        .orderBy(desc(translationTasks.createdAt));
    },

    async update(
      id: string,
      data: Partial<InsertTranslationTask>
    ): Promise<void> {
      await db
        .update(translationTasks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(translationTasks.id, id));
    },

    async updateStatus(
      id: string,
      status: 'pending' | 'processing' | 'completed' | 'failed',
      errorMessage?: string
    ): Promise<void> {
      await db
        .update(translationTasks)
        .set({
          status,
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(translationTasks.id, id));
    },

    async incrementCompleted(id: string): Promise<void> {
      await db
        .update(translationTasks)
        .set({
          completedLanguages: sql`${translationTasks.completedLanguages} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(translationTasks.id, id));
    },

    async incrementFailed(id: string): Promise<void> {
      await db
        .update(translationTasks)
        .set({
          failedLanguages: sql`${translationTasks.failedLanguages} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(translationTasks.id, id));
    },

    async getAllActive(): Promise<TranslationTask[]> {
      return await db
        .select()
        .from(translationTasks)
        .where(eq(translationTasks.status, 'processing'))
        .orderBy(desc(translationTasks.createdAt));
    },

    async getRecent(limit = 20): Promise<TranslationTask[]> {
      return await db
        .select()
        .from(translationTasks)
        .orderBy(desc(translationTasks.createdAt))
        .limit(limit);
    },
  },

  templateTranslations: {
    async create(
      data: InsertTemplateTranslation
    ): Promise<TemplateTranslation> {
      const [translation] = await db
        .insert(templateTranslations)
        .values(data)
        .returning();
      return translation;
    },

    async findByTemplateId(templateId: string): Promise<TemplateTranslation[]> {
      return await db
        .select()
        .from(templateTranslations)
        .where(eq(templateTranslations.templateId, templateId))
        .orderBy(desc(templateTranslations.createdAt));
    },

    async findByTaskIds(
      taskIds: string[]
    ): Promise<Record<string, TemplateTranslation[]>> {
      if (taskIds.length === 0) {
        return {};
      }

      const rows = await db
        .select()
        .from(templateTranslations)
        .where(inArray(templateTranslations.taskId, taskIds))
        .orderBy(desc(templateTranslations.createdAt));

      return rows.reduce<Record<string, TemplateTranslation[]>>(
        (acc, translation) => {
          if (!acc[translation.taskId]) {
            acc[translation.taskId] = [];
          }
          acc[translation.taskId].push(translation);
          return acc;
        },
        {}
      );
    },

    async findByTaskId(taskId: string): Promise<TemplateTranslation[]> {
      return await db
        .select()
        .from(templateTranslations)
        .where(eq(templateTranslations.taskId, taskId));
    },

    async findByTemplateAndLanguage(
      templateId: string,
      languageCode: string
    ): Promise<TemplateTranslation | undefined> {
      const [translation] = await db
        .select()
        .from(templateTranslations)
        .where(
          and(
            eq(templateTranslations.templateId, templateId),
            eq(templateTranslations.languageCode, languageCode)
          )
        )
        .orderBy(desc(templateTranslations.createdAt))
        .limit(1);
      return translation;
    },

    async update(
      id: string,
      data: Partial<InsertTemplateTranslation>
    ): Promise<void> {
      await db
        .update(templateTranslations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(templateTranslations.id, id));
    },

    async updateStatus(
      id: string,
      status: 'pending' | 'processing' | 'completed' | 'failed',
      errorMessage?: string
    ): Promise<void> {
      await db
        .update(templateTranslations)
        .set({
          status,
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(templateTranslations.id, id));
    },
  },
};
