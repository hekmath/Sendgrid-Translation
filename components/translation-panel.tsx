'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Languages,
  Play,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Copy,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';

import {
  getLanguageByCode,
  type LanguageCode,
} from '@/lib/constants/languages';
import type { TranslationTask, TemplateTranslation } from '@/lib/db/schema';
import { SimpleLanguageSelect } from './simple-language-select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SendGridTemplateVersion {
  id: string;
  template_id: string;
  active: number;
  name: string;
  html_content: string;
  subject: string;
}

interface SendGridTemplate {
  id: string;
  name: string;
  versions: SendGridTemplateVersion[];
}

interface TranslationPanelProps {
  template: SendGridTemplate;
  activeVersion: SendGridTemplateVersion;
  onTranslationSelect?: (translation: TemplateTranslation | null) => void;
  selectedTranslationId?: string;
}

interface TranslationData {
  tasks: TranslationTask[];
  translations: TemplateTranslation[];
}

export function TranslationPanel({
  template,
  activeVersion,
  onTranslationSelect,
  selectedTranslationId,
}: TranslationPanelProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<LanguageCode[]>(
    []
  );
  const queryClient = useQueryClient();
  const [retranslateTarget, setRetranslateTarget] =
    useState<TemplateTranslation | null>(null);
  const [retranslateReason, setRetranslateReason] = useState('');
  const [deleteTarget, setDeleteTarget] =
    useState<TemplateTranslation | null>(null);

  // Fetch translation data
  const {
    data: translationData,
    isPending: isLoadingTranslations,
    isError: isTranslationsError,
    error: translationsError,
  } = useQuery({
    queryKey: ['translations', template.id],
    queryFn: async (): Promise<TranslationData> => {
      const response = await fetch(`/api/translations/${template.id}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Failed to fetch translations');
      const result = await response.json();
      return result.data;
    },
    refetchInterval: 5000, // Poll every 5 seconds for status updates
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Start translation mutation
  const startTranslation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/translations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          templateName: template.name,
          templateVersionId: activeVersion.id,
          htmlContent: activeVersion.html_content,
          subject: activeVersion.subject,
          targetLanguages: selectedLanguages,
        }),
      });

      if (!response.ok) throw new Error('Failed to start translation');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Translation job started successfully');
      setSelectedLanguages([]);
      queryClient.invalidateQueries({
        queryKey: ['translations', template.id],
      });
    },
    onError: (error) => {
      toast.error(`Failed to start translation: ${error.message}`);
    },
  });

  const retranslateMutation = useMutation({
    mutationFn: async (variables: { translationId: string; reason: string }) => {
      const response = await fetch('/api/translations/retranslate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(variables),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error ?? 'Failed to request retranslation';
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Retranslation requested');
      setRetranslateReason('');
      setRetranslateTarget(null);
      queryClient.invalidateQueries({ queryKey: ['translations', template.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (translationId: string) => {
      const response = await fetch(`/api/translations/translation/${translationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error ?? 'Failed to verify translation';
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Translation marked as verified');
      queryClient.invalidateQueries({ queryKey: ['translations', template.id] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (translationId: string) => {
      const response = await fetch(
        `/api/translations/translation/${translationId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body?.error ?? 'Failed to delete translation';
        throw new Error(message);
      }

      return response.json();
    },
    onSuccess: (_, translationId) => {
      toast.success('Translation removed');
      if (selectedTranslationId === translationId) {
        onTranslationSelect?.(null);
      }
      queryClient.invalidateQueries({ queryKey: ['translations', template.id] });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleStartTranslation = () => {
    if (selectedLanguages.length === 0) {
      toast.error('Please select at least one language');
      return;
    }
    startTranslation.mutate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'processing':
        return 'secondary';
      case 'queued':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatTaskStatus = (status: string) =>
    status.charAt(0).toUpperCase() + status.slice(1);

  const tasksForVersion = useMemo(
    () =>
      (translationData?.tasks || []).filter(
        (task) => task.templateVersionId === activeVersion.id
      ),
    [translationData?.tasks, activeVersion.id]
  );

  const activeTasks = useMemo(
    () =>
      tasksForVersion.filter((task) =>
        ['queued', 'processing', 'pending'].includes(task.status)
      ),
    [tasksForVersion]
  );

  const translationsForVersion = useMemo(
    () =>
      (translationData?.translations || []).filter(
        (translation) =>
          translation.templateVersionId === activeVersion.id &&
          !translation.deletedAt
      ),
    [translationData?.translations, activeVersion.id]
  );

  const languageGroups = useMemo(() => {
    const map = new Map<LanguageCode, TemplateTranslation[]>();

    translationsForVersion.forEach((translation) => {
      const code = translation.languageCode as LanguageCode;
      const list = map.get(code) ?? [];
      list.push(translation);
      map.set(code, list);
    });

    return Array.from(map.entries())
      .map(([code, versions]) => ({
        code,
        language: getLanguageByCode(code),
        versions: versions
          .slice()
          .sort((a, b) => {
            if (a.version !== b.version) {
              return b.version - a.version;
            }
            return (
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
          }),
      }))
      .sort((a, b) => {
        const nameA = a.language?.name ?? a.code;
        const nameB = b.language?.name ?? b.code;
        return nameA.localeCompare(nameB);
      });
  }, [translationsForVersion]);

  const formatTimestamp = useCallback((value: string | Date) => {
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const handleCopyHtml = useCallback(async (translation: TemplateTranslation) => {
    if (!translation.translatedHtml?.trim()) {
      toast.error('Translation HTML is not available yet.');
      return;
    }

    try {
      await navigator.clipboard.writeText(translation.translatedHtml);
      toast.success('Translated HTML copied to clipboard');
    } catch (error) {
      console.error('Failed to copy translation HTML:', error);
      toast.error('Failed to copy translation HTML');
    }
  }, []);

  const canSubmitRetranslate = retranslateReason.trim().length >= 5;

  const handleRetranslateSubmit = useCallback(() => {
    if (!retranslateTarget || !canSubmitRetranslate) return;

    retranslateMutation.mutate({
      translationId: retranslateTarget.id,
      reason: retranslateReason.trim(),
    });
  }, [retranslateTarget, canSubmitRetranslate, retranslateMutation, retranslateReason]);

  const handleVerify = useCallback(
    (translation: TemplateTranslation) => {
      verifyMutation.mutate(translation.id);
    },
    [verifyMutation]
  );

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
  }, [deleteMutation, deleteTarget]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Template Translations
        </CardTitle>
        <CardDescription>
          Translate this template to different languages using AI
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Start New Translation */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Start New Translation</h4>
            <SimpleLanguageSelect
              selectedLanguages={selectedLanguages}
              onSelectionChange={setSelectedLanguages}
              disabled={startTranslation.isPending}
            />
          </div>

          <Button
            onClick={handleStartTranslation}
            disabled={
              selectedLanguages.length === 0 || startTranslation.isPending
            }
            className="w-full"
          >
            {startTranslation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Starting Translation...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start Translation
              </>
            )}
          </Button>
        </div>

        {isTranslationsError && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {translationsError instanceof Error
              ? translationsError.message
              : 'Unable to load translation data'}
          </div>
        )}

        {/* Active Jobs */}
        {activeTasks.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Active Translation Jobs</h4>
            {activeTasks.map((task) => (
              <div key={task.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={getStatusColor(task.status)}
                    className="capitalize"
                  >
                    {getStatusIcon(task.status)}
                    <span className="ml-1">{formatTaskStatus(task.status)}</span>
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {task.completedLanguages}/{task.totalLanguages} completed
                  </span>
                </div>

                <div className="text-xs text-muted-foreground">
                  Languages:{' '}
                  {task.targetLanguages
                    .map((code) => getLanguageByCode(code)?.name || code)
                    .join(', ')}
                </div>

                {task.errorMessage && (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                    Error: {task.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Language Versions */}
        {languageGroups.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Translation Versions</h4>
            <div className="space-y-3">
              {languageGroups.map(({ code, language, versions }) => {
                const latest = versions[0];

                return (
                  <div key={code} className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {language?.name || code}
                          </span>
                          {language?.nativeName && (
                            <Badge variant="outline" className="text-[10px]">
                              {language.nativeName}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] uppercase">
                            Latest v{latest.version}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {latest.status === 'completed'
                            ? 'Translation ready'
                            : `Status: ${latest.status}`}
                        </div>
                      </div>
                      {latest.verifiedAt && (
                        <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2">
                      {versions.map((translation) => {
                        const isSelected = selectedTranslationId === translation.id;
                        const isInProgress = ['processing', 'pending'].includes(
                          translation.status
                        );
                        const isLatest = latest.id === translation.id;
                        const canPreview = Boolean(
                          translation.translatedHtml && !isInProgress
                        );
                        const canVerify =
                          translation.status === 'completed' &&
                          !translation.verifiedAt;

                        return (
                          <div
                            key={translation.id}
                            className={cn(
                              'rounded-md border p-3 transition-colors',
                              isSelected
                                ? 'border-primary/70 bg-primary/5 shadow-sm'
                                : 'hover:bg-accent/40'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    v{translation.version}
                                  </Badge>
                                  <Badge
                                    variant={getStatusColor(translation.status)}
                                    className="flex items-center gap-1 capitalize"
                                  >
                                    {getStatusIcon(translation.status)}
                                    <span>
                                      {translation.status === 'pending'
                                        ? 'queued'
                                        : translation.status}
                                    </span>
                                  </Badge>
                                  {isLatest && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Latest
                                    </Badge>
                                  )}
                                  {isSelected && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      Previewing
                                    </Badge>
                                  )}
                                  {translation.verifiedAt && (
                                    <Badge variant="secondary" className="flex items-center gap-1 text-[10px]">
                                      <CheckCircle className="h-3 w-3" /> Verified
                                    </Badge>
                                  )}
                                  {translation.retranslateAttempts > 0 && (
                                    <span className="text-xs text-muted-foreground">
                                      {translation.retranslateAttempts} retranslate
                                      {translation.retranslateAttempts > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-muted-foreground">
                                  Updated {formatTimestamp(translation.updatedAt)}
                                </div>

                                {translation.retranslateReason && (
                                  <div className="text-xs text-muted-foreground/80">
                                    Last feedback: {translation.retranslateReason}
                                  </div>
                                )}

                                {translation.errorMessage && (
                                  <div className="text-xs text-destructive">
                                    Error: {translation.errorMessage}
                                  </div>
                                )}
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      if (canPreview) {
                                        onTranslationSelect?.(translation);
                                      }
                                    }}
                                    disabled={!canPreview}
                                  >
                                    <Eye className="mr-2 h-4 w-4" /> Preview
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={(event) => {
                                      event.preventDefault();
                                      void handleCopyHtml(translation);
                                    }}
                                    disabled={!translation.translatedHtml}
                                  >
                                    <Copy className="mr-2 h-4 w-4" /> Copy HTML
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setRetranslateTarget(translation);
                                      setRetranslateReason(
                                        translation.retranslateReason ?? ''
                                      );
                                    }}
                                    disabled={
                                      isInProgress ||
                                      retranslateMutation.isPending ||
                                      deleteMutation.isPending
                                    }
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" /> Request
                                    Retranslate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      handleVerify(translation);
                                    }}
                                    disabled={
                                      !canVerify ||
                                      verifyMutation.isPending ||
                                      deleteMutation.isPending
                                    }
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    {translation.verifiedAt
                                      ? 'Verified'
                                      : 'Mark as Verified'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      setDeleteTarget(translation);
                                    }}
                                    className="text-destructive focus:text-destructive"
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoadingTranslations &&
          !isTranslationsError &&
          activeTasks.length === 0 &&
          languageGroups.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Languages className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No translations yet</p>
              <p className="text-xs">Select languages above to get started</p>
            </div>
          )}

        <Dialog
          open={Boolean(retranslateTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setRetranslateTarget(null);
              setRetranslateReason('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Retranslation</DialogTitle>
              <DialogDescription>
                Provide guidance for the new translation so we can refine the
                copy.
              </DialogDescription>
            </DialogHeader>

            {retranslateTarget && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <div className="font-medium">
                    {getLanguageByCode(retranslateTarget.languageCode)?.name ||
                      retranslateTarget.languageCode}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getLanguageByCode(retranslateTarget.languageCode)?.nativeName}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Current version: v{retranslateTarget.version}
                  </div>
                  {retranslateTarget.retranslateAttempts > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Previous retranslate attempts:{' '}
                      {retranslateTarget.retranslateAttempts}
                    </div>
                  )}
                  {retranslateTarget.retranslateReason && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Last feedback: {retranslateTarget.retranslateReason}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    What should change?
                  </label>
                  <Textarea
                    value={retranslateReason}
                    onChange={(event) => setRetranslateReason(event.target.value)}
                    placeholder="Explain what needs to be different in the next translation..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 5 characters. Be specific about tone, wording, or
                    context.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setRetranslateTarget(null);
                  setRetranslateReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleRetranslateSubmit}
                disabled={!canSubmitRetranslate || retranslateMutation.isPending}
              >
                {retranslateMutation.isPending ? 'Requesting…' : 'Retranslate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Translation</DialogTitle>
              <DialogDescription>
                This translation version will be removed from the list but can be
                recreated by retranslating again.
              </DialogDescription>
            </DialogHeader>

            {deleteTarget && (
              <div className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <div className="flex items-center gap-2 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span>v{deleteTarget.version}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {getLanguageByCode(deleteTarget.languageCode)?.name ||
                    deleteTarget.languageCode}
                </div>
                {deleteTarget.retranslateReason && (
                  <p className="text-xs text-muted-foreground">
                    Feedback: {deleteTarget.retranslateReason}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
