import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { inngest } from '@/inngest/client';
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
  try {
    const body = await request.json();
    const validatedData = startTranslationSchema.parse(body);

    console.log(
      `Starting translation for template ${validatedData.templateId}`
    );

    // Send event to Inngest coordinator
    await inngest.send({
      name: 'translation/coordinate',
      data: {
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
      message: 'Translation job started successfully',
    });
  } catch (error) {
    console.error('Failed to start translation:', error);

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
