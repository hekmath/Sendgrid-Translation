import { inngest } from './client';
import { dbService } from '@/lib/services/db-service';
import type { LanguageCode } from '@/lib/constants/languages';

interface TranslationJobEvent {
  data: {
    templateId: string;
    templateName: string;
    templateVersionId: string;
    htmlContent: string;
    subject: string;
    targetLanguages: LanguageCode[];
  };
}

export const coordinateTranslation = inngest.createFunction(
  {
    id: 'coordinate-translation',
    name: 'Coordinate Translation Job',
    concurrency: {
      limit: 3,
    },
    retries: 2,
  },
  { event: 'translation/coordinate' },
  async ({ event, step }) => {
    const {
      templateId,
      templateName,
      templateVersionId,
      htmlContent,
      subject,
      targetLanguages,
    } = event.data as TranslationJobEvent['data'];

    console.log(`Starting translation coordination for template ${templateId}`);

    // Step 1: Create translation task
    const task = await step.run('create-translation-task', async () => {
      return await dbService.translationTasks.create({
        templateId,
        templateName,
        templateVersionId,
        sourceLanguage: 'en',
        targetLanguages,
        status: 'processing',
        totalLanguages: targetLanguages.length,
        completedLanguages: 0,
        failedLanguages: 0,
      });
    });

    console.log(
      `Created task ${task.id} for ${targetLanguages.length} languages`
    );

    // Step 2: Dispatch individual language translation jobs
    await step.run('dispatch-language-jobs', async () => {
      const dispatchPromises = targetLanguages.map(async (languageCode) => {
        await inngest.send({
          name: 'translation/translate-language',
          data: {
            taskId: task.id,
            templateId,
            templateVersionId,
            languageCode,
            htmlContent,
            subject,
            totalLanguages: targetLanguages.length,
          },
        });
      });

      await Promise.all(dispatchPromises);
      console.log(
        `Dispatched ${targetLanguages.length} language translation jobs for task ${task.id}`
      );
    });

    // Step 3: Wait for completion with better matching
    const completionResult = await step.waitForEvent('wait-for-completion', {
      event: 'translation/job-completed',
      timeout: '20m',
      if: `async.data.taskId == '${task.id}'`,
    });

    // Step 4: Finalize
    const result = await step.run('finalize-translation', async () => {
      console.log(`Finalizing task ${task.id}`, { completionResult });

      if (!completionResult) {
        console.error(`Task ${task.id} timed out after 20 minutes`);
        await dbService.translationTasks.updateStatus(
          task.id,
          'failed',
          'Translation job timed out after 20 minutes'
        );
        throw new Error('Translation job timed out');
      }

      const { success, error } = completionResult.data;

      if (!success) {
        console.error(`Task ${task.id} failed:`, error);
        await dbService.translationTasks.updateStatus(task.id, 'failed', error);
        throw new Error(`Translation failed: ${error}`);
      }

      await dbService.translationTasks.updateStatus(task.id, 'completed');
      console.log(`Translation completed successfully for task ${task.id}`);

      return { success: true, taskId: task.id };
    });

    return result;
  }
);
