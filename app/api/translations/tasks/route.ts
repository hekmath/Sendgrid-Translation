import { NextResponse } from 'next/server';
import { dbService } from '@/lib/services/db-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const tasks = await dbService.translationTasks.getRecent(25);
    const taskIds = tasks.map((task) => task.id);
    const translationsByTask = await dbService.templateTranslations.findByTaskIds(
      taskIds
    );

    const summaries = tasks.map((task) => ({
      task,
      translations: translationsByTask[task.id] ?? [],
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          summaries,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Failed to fetch translation tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch translation tasks' },
      { status: 500 }
    );
  }
}
