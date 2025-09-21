import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbService } from '@/lib/services/db-service';

interface RouteParams {
  params: Promise<{
    translationId: string;
  }>;
}

const patchSchema = z.object({
  action: z.literal('verify'),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { translationId } = await params;
    const body = await request.json();
    const { action } = patchSchema.parse(body);

    const translation = await dbService.templateTranslations.findById(translationId);
    if (!translation || translation.deletedAt) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
    }

    if (action === 'verify') {
      if (translation.status !== 'completed') {
        return NextResponse.json(
          { error: 'Only completed translations can be verified' },
          { status: 400 }
        );
      }

      await dbService.templateTranslations.markVerified(translationId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (error) {
    console.error('Failed to update translation:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update translation' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { translationId } = await params;
    const translation = await dbService.templateTranslations.findById(translationId);

    if (!translation || translation.deletedAt) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
    }

    await dbService.templateTranslations.softDelete(translationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete translation:', error);
    return NextResponse.json(
      { error: 'Failed to delete translation' },
      { status: 500 }
    );
  }
}
