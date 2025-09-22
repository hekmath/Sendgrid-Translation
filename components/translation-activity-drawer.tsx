'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import {
  Activity,
  CheckCircle,
  Clock,
  Loader2,
  PanelTopOpen,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  getLanguageByCode,
  type LanguageCode,
} from '@/lib/constants/languages';
import type {
  TemplateTranslation,
  TranslationTask,
} from '@/lib/db/schema';

interface TranslationTaskSummary {
  task: TranslationTask;
  translations: TemplateTranslation[];
}

interface TaskResponse {
  summaries: TranslationTaskSummary[];
}

const STATUS_VARIANT: Record<TranslationTask['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  failed: 'destructive',
  processing: 'secondary',
  queued: 'outline',
  pending: 'outline',
};

function getStatusIcon(status: TranslationTask['status']) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4" />;
    case 'failed':
      return <XCircle className="h-4 w-4" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case 'queued':
      return <Clock className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function formatUpdatedAt(updatedAt: string | Date) {
  const date = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  return date.toLocaleString();
}

export function TranslationActivityDrawer() {
  const { isSignedIn } = useUser();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const previousStatuses = useRef<Record<string, TranslationTask['status']>>({});
  const initializedStatuses = useRef(false);

  const { data, isFetching } = useQuery({
    queryKey: ['translation-task-activity'],
    queryFn: async (): Promise<TaskResponse> => {
      const response = await fetch('/api/translations/tasks', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch translation activity');
      }

      const result = await response.json();
      return result.data as TaskResponse;
    },
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    staleTime: 0,
    refetchOnWindowFocus: true,
    enabled: isSignedIn, // Only fetch when user is signed in
  });

  const debouncedSummaries = useDebouncedValue<TranslationTaskSummary[]>(
    data?.summaries ?? [],
    250
  );

  const activeSummaries = useMemo(
    () =>
      debouncedSummaries.filter(({ task }) =>
        ['queued', 'processing', 'pending'].includes(task.status)
      ),
    [debouncedSummaries]
  );

  const recentSummaries = useMemo(
    () =>
      debouncedSummaries.filter(({ task }) =>
        ['completed', 'failed'].includes(task.status)
      ),
    [debouncedSummaries]
  );

  useEffect(() => {
    if (!debouncedSummaries.length) {
      return;
    }

    if (!initializedStatuses.current) {
      debouncedSummaries.forEach(({ task }) => {
        previousStatuses.current[task.id] = task.status;
      });
      initializedStatuses.current = true;
      return;
    }

    debouncedSummaries.forEach(({ task }) => {
      const previousStatus = previousStatuses.current[task.id];
      if (previousStatus !== task.status) {
        previousStatuses.current[task.id] = task.status;

        if (task.status === 'completed' || task.status === 'failed') {
          queryClient.invalidateQueries({
            queryKey: ['translations', task.templateId],
          });
        }
      }
    });

    const currentTaskIds = new Set(
      debouncedSummaries.map(({ task }) => task.id)
    );

    Object.keys(previousStatuses.current).forEach((taskId) => {
      if (!currentTaskIds.has(taskId)) {
        delete previousStatuses.current[taskId];
      }
    });
  }, [debouncedSummaries, queryClient]);

  const activeCount = activeSummaries.length;

  // Don't render the component if user is not signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-4 right-4 z-40 shadow-lg"
          variant={activeCount > 0 ? 'default' : 'outline'}
        >
          <div className="flex items-center gap-2">
            <PanelTopOpen className="h-4 w-4" />
            <span>Translation Activity</span>
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeCount}
              </Badge>
            )}
          </div>
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[70vh] p-0">
        <SheetHeader className="border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5" />
              Translation Activity
            </SheetTitle>
            <Badge variant={isFetching ? 'secondary' : 'outline'}>
              {isFetching ? 'Updating…' : 'Live'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground px-4">
            Track running and recently completed translation jobs.
          </p>
        </SheetHeader>

        <ScrollArea className="max-h-full">
          <div className="space-y-6 p-4">
            <section>
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Active ({activeSummaries.length})
                </h3>
              </header>
              {activeSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active translations right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeSummaries.map(({ task, translations }) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      translations={translations}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <header className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Recently Finished ({recentSummaries.length})
                </h3>
              </header>
              {recentSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No completed translations yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentSummaries.map(({ task, translations }) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      translations={translations}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface TaskCardProps {
  task: TranslationTask;
  translations: TemplateTranslation[];
}

function TaskCard({ task, translations }: TaskCardProps) {
  const languageBadges = useMemo(
    () =>
      task.targetLanguages.map((code) => (
        <Badge key={`${task.id}-${code}`} variant="outline" className="capitalize">
          {getLanguageByCode(code)?.name ?? code}
        </Badge>
      )),
    [task.id, task.targetLanguages]
  );

  const perLanguageStatuses = useMemo(() => {
    if (!translations.length) {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1">
        {translations.map((translation) => {
          const language = getLanguageByCode(translation.languageCode as LanguageCode);
          const badgeVariant =
            translation.status === 'completed'
              ? 'secondary'
              : translation.status === 'failed'
              ? 'destructive'
              : 'outline';

          return (
            <Badge
              key={translation.id}
              variant={badgeVariant}
              className="flex items-center gap-1"
            >
              {language?.name ?? translation.languageCode}
              <span className="text-[10px] uppercase">v{translation.version}</span>
              {translation.status === 'completed' ? (
                <CheckCircle className="h-3 w-3" />
              ) : translation.status === 'failed' ? (
                <XCircle className="h-3 w-3" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {translation.verifiedAt && (
                <CheckCircle className="h-3 w-3 text-green-600" />
              )}
            </Badge>
          );
        })}
      </div>
    );
  }, [translations]);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{task.templateName}</p>
            <p className="text-xs text-muted-foreground">
              Started {formatUpdatedAt(task.createdAt)}
            </p>
          </div>
          <Badge
            variant={STATUS_VARIANT[task.status]}
            className="flex items-center gap-1 capitalize"
          >
            {getStatusIcon(task.status)}
            {task.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {task.completedLanguages}/{task.totalLanguages} completed
          </span>
          {task.failedLanguages > 0 && (
            <span className="text-destructive">
              {task.failedLanguages} failed
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 text-xs">{languageBadges}</div>

        {perLanguageStatuses}

        {task.errorMessage && (
          <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
            {task.errorMessage}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Last updated {formatUpdatedAt(task.updatedAt)}
        </p>
      </div>
    </div>
  );
}
