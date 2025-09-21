import { db } from '@/lib/db';
import {
  translationTasks,
  templateTranslations,
  type InsertTranslationTask,
  type InsertTemplateTranslation,
  type TranslationTask,
  type TemplateTranslation,
} from '@/lib/db/schema';
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';

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
      status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed',
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

    async syncCounts(id: string): Promise<void> {
      const [counts] = await db
        .select({
          completed: sql<number>`SUM(CASE WHEN ${templateTranslations.status} = 'completed' THEN 1 ELSE 0 END)`,
          failed: sql<number>`SUM(CASE WHEN ${templateTranslations.status} = 'failed' THEN 1 ELSE 0 END)`,
        })
        .from(templateTranslations)
        .where(
          and(
            eq(templateTranslations.taskId, id),
            isNull(templateTranslations.deletedAt)
          )
        );

      const completedCount = counts?.completed ?? 0;
      const failedCount = counts?.failed ?? 0;

      await db
        .update(translationTasks)
        .set({
          completedLanguages: completedCount,
          failedLanguages: failedCount,
          updatedAt: new Date(),
        })
        .where(eq(translationTasks.id, id));
    },

    async getAllActive(): Promise<TranslationTask[]> {
      return await db
        .select()
        .from(translationTasks)
        .where(inArray(translationTasks.status, ['queued', 'processing']))
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
        .where(
          and(
            eq(templateTranslations.templateId, templateId),
            isNull(templateTranslations.deletedAt)
          )
        )
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
        .where(
          and(
            inArray(templateTranslations.taskId, taskIds),
            isNull(templateTranslations.deletedAt)
          )
        )
        .orderBy(desc(templateTranslations.createdAt));

      return rows.reduce<Record<string, TemplateTranslation[]>>(
        (acc, translation) => {
          const bucket = acc[translation.taskId] || [];
          const existingIndex = bucket.findIndex(
            (entry) => entry.languageCode === translation.languageCode
          );

          if (existingIndex === -1) {
            bucket.push(translation);
          } else {
            const existing = bucket[existingIndex];
            const isNewerVersion = translation.version > existing.version;
            const isSameVersionNewerTimestamp =
              translation.version === existing.version &&
              translation.updatedAt > existing.updatedAt;

            if (isNewerVersion || isSameVersionNewerTimestamp) {
              bucket[existingIndex] = translation;
            }
          }

          acc[translation.taskId] = bucket;
          return acc;
        },
        {}
      );
    },

    async findByTaskId(taskId: string): Promise<TemplateTranslation[]> {
      return await db
        .select()
        .from(templateTranslations)
        .where(
          and(
            eq(templateTranslations.taskId, taskId),
            isNull(templateTranslations.deletedAt)
          )
        )
        .orderBy(desc(templateTranslations.createdAt));
    },

    async findLatestByTaskAndLanguage(
      taskId: string,
      languageCode: string
    ): Promise<TemplateTranslation | undefined> {
      const [translation] = await db
        .select()
        .from(templateTranslations)
        .where(
          and(
            eq(templateTranslations.taskId, taskId),
            eq(templateTranslations.languageCode, languageCode),
            isNull(templateTranslations.deletedAt)
          )
        )
        .orderBy(desc(templateTranslations.createdAt))
        .limit(1);

      return translation;
    },

    async findById(id: string): Promise<TemplateTranslation | undefined> {
      const [translation] = await db
        .select()
        .from(templateTranslations)
        .where(eq(templateTranslations.id, id));
      return translation;
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
            eq(templateTranslations.languageCode, languageCode),
            isNull(templateTranslations.deletedAt)
          )
        )
        .orderBy(
          desc(templateTranslations.version),
          desc(templateTranslations.createdAt)
        )
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

    async requestRetranslate(
      id: string,
      reason: string
    ): Promise<
      | {
          newTranslation: TemplateTranslation;
          previousTranslation: TemplateTranslation;
          previousStatus: TemplateTranslation['status'];
        }
      | undefined
    > {
      const existing = await this.findById(id);
      if (!existing) {
        return undefined;
      }

      if (existing.deletedAt) {
        return undefined;
      }

      const previousStatus = existing.status;
      const now = new Date();

      const nextVersion = await this.getNextVersion(
        existing.templateId,
        existing.templateVersionId,
        existing.languageCode
      );

      const [newTranslation] = await db
        .insert(templateTranslations)
        .values({
          taskId: existing.taskId,
          templateId: existing.templateId,
          templateVersionId: existing.templateVersionId,
          languageCode: existing.languageCode,
          originalHtml: existing.originalHtml,
          originalSubject: existing.originalSubject,
          status: 'processing',
          retranslateReason: reason,
          retranslateAttempts: 0,
          version: nextVersion,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!newTranslation) {
        return undefined;
      }

      await db
        .update(templateTranslations)
        .set({
          retranslateAttempts: existing.retranslateAttempts + 1,
          updatedAt: now,
        })
        .where(eq(templateTranslations.id, existing.id));

      if (previousStatus === 'completed') {
        await db
          .update(translationTasks)
          .set({
            completedLanguages: sql`GREATEST(${translationTasks.completedLanguages} - 1, 0)`,
            updatedAt: now,
          })
          .where(eq(translationTasks.id, newTranslation.taskId));
      } else if (previousStatus === 'failed') {
        await db
          .update(translationTasks)
          .set({
            failedLanguages: sql`GREATEST(${translationTasks.failedLanguages} - 1, 0)`,
            updatedAt: now,
          })
          .where(eq(translationTasks.id, newTranslation.taskId));
      }

      return {
        newTranslation,
        previousTranslation: existing,
        previousStatus,
      };
    },

    async getNextVersion(
      templateId: string,
      templateVersionId: string,
      languageCode: string
    ): Promise<number> {
      const [result] = await db
        .select({
          maxVersion: sql<number>`COALESCE(MAX(${templateTranslations.version}), 0)`,
        })
        .from(templateTranslations)
        .where(
          and(
            eq(templateTranslations.templateId, templateId),
            eq(templateTranslations.templateVersionId, templateVersionId),
            eq(templateTranslations.languageCode, languageCode)
          )
        );

      const maxVersion = result?.maxVersion ?? 0;
      return maxVersion + 1;
    },

    async markVerified(id: string): Promise<void> {
      await db
        .update(templateTranslations)
        .set({
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(templateTranslations.id, id),
            isNull(templateTranslations.deletedAt)
          )
        );
    },

    async softDelete(id: string): Promise<void> {
      await db
        .update(templateTranslations)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(templateTranslations.id, id));
    },
  },
};
