import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { inngest } from '@/inngest/client';
import { dbService } from '@/lib/services/db-service';
import type { LanguageCode } from '@/lib/constants/languages';

const startTranslationSchema = z.object({
  templateId: z.string(),
  templateName: z.string(),
  templateVersionId: z.string(),
  htmlContent: z.string(),
  subject: z.string(),
  targetLanguages: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  let taskId: string | null = null;
  try {
    const body = await request.json();
    const validatedData = startTranslationSchema.parse(body);

    console.log(
      `Starting translation for template ${validatedData.templateId}`
    );

    const task = await dbService.translationTasks.create({
      templateId: validatedData.templateId,
      templateName: validatedData.templateName,
      templateVersionId: validatedData.templateVersionId,
      sourceLanguage: 'en',
      targetLanguages: validatedData.targetLanguages as LanguageCode[],
      status: 'queued',
      totalLanguages: validatedData.targetLanguages.length,
      completedLanguages: 0,
      failedLanguages: 0,
    });

    taskId = task.id;

    // Send event to Inngest coordinator
    await inngest.send({
      name: 'translation/coordinate',
      data: {
        taskId: task.id,
        templateId: validatedData.templateId,
        templateName: validatedData.templateName,
        templateVersionId: validatedData.templateVersionId,
        htmlContent: validatedData.htmlContent,
        subject: validatedData.subject,
        targetLanguages: validatedData.targetLanguages as LanguageCode[],
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Translation job queued successfully',
      taskId: task.id,
    });
  } catch (error) {
    console.error('Failed to start translation:', error);

    if (taskId) {
      await dbService.translationTasks.updateStatus(
        taskId,
        'failed',
        'Failed to enqueue translation job'
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to start translation job' },
      { status: 500 }
    );
  }
}
