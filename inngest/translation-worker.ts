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
  };
}

const translationOutputSchema = z.object({
  html: z
    .string()
    .describe('The translated HTML with structure and Handlebars intact'),
  subject: z.string().describe('The translated email subject line'),
  notes: z.array(z.string()).optional().describe('Optional translation notes'),
});

export const translateLanguage = inngest.createFunction(
  {
    id: 'translate-language',
    name: 'Translate Single Language',
    concurrency: {
      limit: 10,
    },
    retries: 3,
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

    const result = await step.run(`translate-${languageCode}`, async () => {
      try {
        // Create translation record
        const translation = await dbService.templateTranslations.create({
          taskId,
          templateId,
          templateVersionId,
          languageCode,
          originalHtml: htmlContent,
          originalSubject: subject,
          status: 'processing',
        });

        // Get target language info
        const targetLanguage = getLanguageByCode(languageCode);
        if (!targetLanguage) {
          throw new Error(`Unsupported language code: ${languageCode}`);
        }

        // Create system prompt
        const systemPrompt = `You are a professional email template translator specializing in SendGrid dynamic templates.

CRITICAL RULES:
1. NEVER translate or modify Handlebars variables like {{name}}, {{email}}, {{unsubscribe_url}}
2. NEVER translate or modify HTML tags, attributes, CSS classes, or IDs
3. NEVER translate URLs, email addresses, or links
4. Preserve all HTML structure and formatting exactly
5. Translate ONLY human-readable text content and subject line
6. Maintain professional email tone and marketing language
7. Keep translations concise and natural for ${targetLanguage.name}

Translate the email template from English to ${targetLanguage.name} (${targetLanguage.nativeName}).`;

        // Call AI for translation
        const translationResult = await generateObject({
          model: openai('gpt-4o-mini'),
          system: systemPrompt,
          prompt: `Translate this SendGrid email template:

HTML:
${htmlContent}

SUBJECT:
${subject}

Provide clean translations while preserving all technical elements.`,
          schema: translationOutputSchema,
        });

        // Update translation with results
        await dbService.templateTranslations.update(translation.id, {
          translatedHtml: translationResult.object.html,
          translatedSubject: translationResult.object.subject,
          status: 'completed',
        });

        // Update task counters
        await dbService.translationTasks.incrementCompleted(taskId);

        console.log(
          `Completed translation for ${languageCode} in task ${taskId}`
        );
        return { success: true, languageCode, translationId: translation.id };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `Translation failed for ${languageCode} in task ${taskId}:`,
          errorMessage
        );

        // Create failed translation record
        const translation = await dbService.templateTranslations.create({
          taskId,
          templateId,
          templateVersionId,
          languageCode,
          originalHtml: htmlContent,
          originalSubject: subject,
          status: 'failed',
          errorMessage,
        });

        // Update task counters
        await dbService.translationTasks.incrementFailed(taskId);

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
