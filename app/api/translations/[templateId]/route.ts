import { NextRequest, NextResponse } from 'next/server';
import { dbService } from '@/lib/services/db-service';

interface RouteParams {
  params: Promise<{
    templateId: string;
  }>;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { templateId } = await params;

    const [tasks, translations] = await Promise.all([
      dbService.translationTasks.findByTemplateId(templateId),
      dbService.templateTranslations.findByTemplateId(templateId),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          tasks,
          translations,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch translations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translation data' },
      { status: 500 }
    );
  }
}
