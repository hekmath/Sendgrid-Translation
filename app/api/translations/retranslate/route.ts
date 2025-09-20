import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbService } from '@/lib/services/db-service';
import { inngest } from '@/inngest/client';

const retranslateSchema = z.object({
  translationId: z.string().uuid(),
  reason: z.string().min(5).max(500),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { translationId, reason } = retranslateSchema.parse(body);

    const existing = await dbService.templateTranslations.findById(translationId);
    if (!existing) {
      return NextResponse.json(
        { error: 'Translation not found' },
        { status: 404 }
      );
    }

    if (['processing', 'pending'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Translation is still processing' },
        { status: 400 }
      );
    }

    const result = await dbService.templateTranslations.requestRetranslate(
      translationId,
      reason
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Unable to request retranslation' },
        { status: 500 }
      );
    }

    const { translation, previousStatus } = result;

    const task = await dbService.translationTasks.findById(translation.taskId);

    if (!task) {
      return NextResponse.json(
        { error: 'Translation task not found' },
        { status: 404 }
      );
    }

    await dbService.translationTasks.updateStatus(translation.taskId, 'processing');

    await inngest.send({
      name: 'translation/retranslate-language',
      data: {
        translationId: translation.id,
        taskId: translation.taskId,
        templateId: translation.templateId,
        templateVersionId: translation.templateVersionId,
        languageCode: translation.languageCode,
        reason,
        htmlContent: translation.originalHtml,
        subject: translation.originalSubject ?? '',
        totalLanguages: task.totalLanguages,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to request retranslation:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to request retranslation' },
      { status: 500 }
    );
  }
}
