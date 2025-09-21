import { inngest } from './client';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getLanguageByCode } from '@/lib/constants/languages';
import { dbService } from '@/lib/services/db-service';
import type { LanguageCode } from '@/lib/constants/languages';

interface TranslateLanguageEvent {
  data: {
    taskId: string;
    templateId: string;
    templateVersionId: string;
    languageCode: LanguageCode;
    htmlContent: string;
    subject: string;
    totalLanguages: number;
    translationId?: string;
    reason?: string;
  };
}

const translationOutputSchema = z.object({
  html: z
    .string()
    .describe('The translated HTML with structure and Handlebars intact'),
  subject: z.string().describe('The translated email subject line'),
  notes: z.array(z.string()).optional().describe('Optional translation notes'),
});

async function runTranslation({
  taskId,
  languageCode,
  htmlContent,
  subject,
  reason,
  translationId,
  isRetranslate,
}: {
  taskId: string;
  languageCode: LanguageCode;
  htmlContent: string;
  subject: string;
  reason?: string;
  translationId?: string;
  isRetranslate: boolean;
}) {
  if (!translationId) {
    const context = isRetranslate ? 'retranslation' : 'translation';
    throw new Error(`Missing translationId for ${context} request`);
  }

  const translationRecord = await dbService.templateTranslations.findById(
    translationId
  );
  if (!translationRecord) {
    throw new Error(`Translation ${translationId} not found`);
  }

  await dbService.templateTranslations.update(translationRecord.id, {
    status: 'processing',
    errorMessage: null,
    retranslateReason: reason ?? translationRecord.retranslateReason,
    updatedAt: new Date(),
  });
  await dbService.translationTasks.syncCounts(taskId);

  const targetLanguage = getLanguageByCode(languageCode);
  if (!targetLanguage) {
    throw new Error(`Unsupported language code: ${languageCode}`);
  }

  const instructions = reason
    ? `\n\nADDITIONAL CONTEXT FROM REVIEWER:\n${reason}`
    : '';

  const systemPrompt = `You are a professional email template translator specializing in SendGrid dynamic templates.

CRITICAL RULES:
1. NEVER translate or modify Handlebars variables like {{name}}, {{email}}, {{unsubscribe_url}}
2. NEVER translate or modify HTML tags, attributes, CSS classes, or IDs
3. NEVER translate URLs, email addresses, or links
4. Preserve all HTML structure and formatting exactly
5. Translate ONLY human-readable text content and subject line
6. Maintain professional email tone and marketing language
7. Keep translations concise and natural for ${targetLanguage.name}

Translate the email template from English to ${targetLanguage.name} (${targetLanguage.nativeName}).${instructions}`;

  try {
    const translationResult = await generateObject({
      model: openai('gpt-5-mini'),
      system: systemPrompt,
      prompt: `Translate this SendGrid email template:

HTML:
${htmlContent}

SUBJECT:
${subject}

Provide clean translations while preserving all technical elements.`,
      schema: translationOutputSchema,
    });

    await dbService.templateTranslations.update(translationRecord.id, {
      translatedHtml: translationResult.object.html,
      translatedSubject: translationResult.object.subject,
      status: 'completed',
      retranslateReason: reason ?? translationRecord.retranslateReason,
    });
    await dbService.translationTasks.syncCounts(taskId);

    return {
      success: true,
      languageCode,
      translationId: translationRecord.id,
      retranslated: isRetranslate,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    await dbService.templateTranslations.update(translationRecord.id, {
      status: 'failed',
      errorMessage,
      retranslateReason: reason ?? translationRecord.retranslateReason,
    });
    await dbService.translationTasks.syncCounts(taskId);

    throw error;
  }
}

export const translateLanguage = inngest.createFunction(
  {
    id: 'translate-language',
    name: 'Translate Single Language',
    concurrency: {
      limit: 10,
    },
    retries: 2,
  },
  { event: 'translation/translate-language' },
  async ({ event, step }) => {
    const {
      taskId,
      templateId,
      templateVersionId,
      languageCode,
      htmlContent,
      subject,
      totalLanguages,
    } = event.data as TranslateLanguageEvent['data'];

    console.log(
      `Translating template ${templateId} to ${languageCode} for task ${taskId}`
    );

    const { translationId } = await step.run(
      `prepare-translation-${languageCode}`,
      async () => {
        const existing =
          await dbService.templateTranslations.findLatestByTaskAndLanguage(
            taskId,
            languageCode
          );

        if (existing) {
          return { translationId: existing.id };
        }

        const nextVersion = await dbService.templateTranslations.getNextVersion(
          templateId,
          templateVersionId,
          languageCode
        );

        const created = await dbService.templateTranslations.create({
          taskId,
          templateId,
          templateVersionId,
          languageCode,
          originalHtml: htmlContent,
          originalSubject: subject,
          status: 'processing',
          version: nextVersion,
        });

        await dbService.translationTasks.syncCounts(taskId);

        return { translationId: created.id };
      }
    );

    const result = await step.run(`translate-${languageCode}`, async () => {
      try {
        return await runTranslation({
          taskId,
          languageCode,
          htmlContent,
          subject,
          translationId,
          reason: undefined,
          isRetranslate: false,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Translation failed for ${languageCode} in task ${taskId}:`,
          errorMessage
        );
        throw error;
      }
    });

    // Check if all translations are complete - WITH PROPER SYNCHRONIZATION
    await step.run('check-completion', async () => {
      // Use a small delay to avoid race conditions with database updates
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const task = await dbService.translationTasks.findById(taskId);
      if (!task) {
        console.error(`Task ${taskId} not found during completion check`);
        return;
      }

      const totalCompleted = task.completedLanguages + task.failedLanguages;

      console.log(
        `Task ${taskId} progress: ${totalCompleted}/${totalLanguages} completed (${task.completedLanguages} success, ${task.failedLanguages} failed)`
      );

      if (totalCompleted === totalLanguages) {
        console.log(
          `All translations completed for task ${taskId}. Sending completion event.`
        );

        // Send completion event with explicit taskId matching
        await inngest.send({
          name: 'translation/job-completed',
          data: {
            taskId: taskId,
            success: task.failedLanguages === 0,
            error:
              task.failedLanguages > 0
                ? `${task.failedLanguages} languages failed`
                : undefined,
            completedLanguages: task.completedLanguages,
            failedLanguages: task.failedLanguages,
            totalLanguages: totalLanguages,
          },
        });

        console.log(`Sent completion event for task ${taskId}`);
      } else {
        console.log(
          `Task ${taskId} not yet complete: ${totalCompleted}/${totalLanguages}`
        );
      }
    });

    return result;
  }
);

export const retranslateLanguage = inngest.createFunction(
  {
    id: 'retranslate-language',
    name: 'Retranslate Single Language',
    concurrency: {
      limit: 10,
    },
    retries: 2,
  },
  { event: 'translation/retranslate-language' },
  async ({ event, step }) => {
    const {
      taskId,
      templateId,
      templateVersionId,
      languageCode,
      htmlContent,
      subject,
      totalLanguages,
      translationId,
      reason,
    } = event.data as TranslateLanguageEvent['data'];

    console.log(
      `Retranslating template ${templateId} to ${languageCode} for task ${taskId}`
    );

    const { translationId: resolvedTranslationId } = await step.run(
      `prepare-retranslation-${languageCode}`,
      async () => {
        if (!translationId) {
          throw new Error('Missing translationId for retranslation event');
        }

        const existing = await dbService.templateTranslations.findById(
          translationId
        );

        if (!existing) {
          throw new Error(`Translation ${translationId} not found`);
        }

        return { translationId: existing.id };
      }
    );

    const result = await step.run(`retranslate-${languageCode}`, async () => {
      try {
        return await runTranslation({
          taskId,
          languageCode,
          htmlContent,
          subject,
          translationId: resolvedTranslationId,
          reason,
          isRetranslate: true,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Retranslation failed for ${languageCode} in task ${taskId}:`,
          errorMessage
        );
        throw error;
      }
    });

    await step.run('retranslate-check-completion', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const task = await dbService.translationTasks.findById(taskId);
      if (!task) {
        console.error(`Task ${taskId} not found during completion check`);
        return;
      }

      const totalCompleted = task.completedLanguages + task.failedLanguages;

      if (totalCompleted === totalLanguages) {
        const taskStatus =
          task.failedLanguages > 0 ? 'failed' : ('completed' as const);
        const errorMessage =
          task.failedLanguages > 0
            ? `${task.failedLanguages} languages failed`
            : undefined;

        await dbService.translationTasks.updateStatus(
          taskId,
          taskStatus,
          errorMessage
        );

        await inngest.send({
          name: 'translation/job-completed',
          data: {
            taskId: taskId,
            success: task.failedLanguages === 0,
            error:
              task.failedLanguages > 0
                ? `${task.failedLanguages} languages failed`
                : undefined,
            completedLanguages: task.completedLanguages,
            failedLanguages: task.failedLanguages,
            totalLanguages: totalLanguages,
          },
        });
      }
    });

    return result;
  }
);
