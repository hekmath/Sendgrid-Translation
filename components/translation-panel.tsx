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
} from 'lucide-react';

import {
  getLanguageByCode,
  type LanguageCode,
} from '@/lib/constants/languages';
import type { TranslationTask, TemplateTranslation } from '@/lib/db/schema';
import { SimpleLanguageSelect } from './simple-language-select';

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
  onTranslationSelect?: (translation: TemplateTranslation) => void;
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
      default:
        return 'outline';
    }
  };

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
        ['processing', 'pending'].includes(task.status)
      ),
    [tasksForVersion]
  );

  const translationsForVersion = useMemo(
    () =>
      (translationData?.translations || []).filter(
        (translation) => translation.templateVersionId === activeVersion.id
      ),
    [translationData?.translations, activeVersion.id]
  );

  const availableTranslations = useMemo(
    () =>
      translationsForVersion.filter((translation) =>
        ['completed', 'processing', 'pending'].includes(translation.status)
      ),
    [translationsForVersion]
  );

  const failedTranslations = useMemo(
    () =>
      translationsForVersion.filter((translation) => translation.status === 'failed'),
    [translationsForVersion]
  );

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
                    <span className="ml-1">{task.status}</span>
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

        {/* Available / In-Progress Translations */}
        {availableTranslations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Translations</h4>
            <div className="space-y-2">
              {availableTranslations.map((translation) => {
                const language = getLanguageByCode(translation.languageCode);
                const isSelected = selectedTranslationId === translation.id;
                const isInProgress = ['processing', 'pending'].includes(
                  translation.status
                );
                const StatusIcon = isInProgress ? RefreshCw : CheckCircle;

                return (
                  <div
                    key={translation.id}
                    className={`flex flex-col gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? 'border-primary/60 bg-primary/5 shadow-sm'
                        : 'hover:bg-accent/40'
                    }`}
                  >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <StatusIcon
                            className={`h-4 w-4 ${
                              isInProgress
                                ? 'text-blue-600 animate-spin'
                                : 'text-green-600'
                            }`}
                          />
                        <div>
                          <div className="font-medium text-sm">
                            {language?.name || translation.languageCode}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{language?.nativeName}</span>
                            <Badge
                              variant={
                                translation.status === 'completed'
                                  ? 'secondary'
                                  : 'outline'
                              }
                              className="capitalize"
                            >
                              {translation.status === 'pending'
                                ? 'queued'
                                : translation.status}
                            </Badge>
                            {translation.retranslateAttempts > 0 && (
                              <span>
                                {translation.retranslateAttempts} retranslate
                                {translation.retranslateAttempts > 1 ? 's' : ''}
                              </span>
                            )}
                            {isSelected && (
                              <Badge variant="secondary" className="text-[10px]">
                                Previewing
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant={isSelected ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => onTranslationSelect?.(translation)}
                          disabled={isInProgress || !translation.translatedHtml}
                          title={
                            isInProgress
                              ? 'Translation still processing'
                              : 'Preview translation'
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyHtml(translation)}
                          disabled={!translation.translatedHtml}
                          title="Copy translated HTML"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setRetranslateTarget(translation);
                            setRetranslateReason(translation.retranslateReason ?? '');
                          }}
                          disabled={isInProgress}
                          title="Request retranslation"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              isInProgress ? 'animate-spin text-blue-600' : ''
                            }`}
                          />
                        </Button>
                      </div>
                    </div>

                    {translation.retranslateReason && (
                      <div className="rounded-md border border-dashed border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                        Last feedback: {translation.retranslateReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Failed Translations */}
        {failedTranslations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-destructive">
              Failed Translations
            </h4>
            <div className="space-y-2">
              {failedTranslations.map((translation) => {
                const language = getLanguageByCode(translation.languageCode);
                return (
                  <div
                    key={translation.id}
                    className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <div>
                        <div className="font-medium text-sm">
                          {language?.name || translation.languageCode}
                        </div>
                        {translation.errorMessage && (
                          <div className="text-xs text-destructive">
                            {translation.errorMessage}
                          </div>
                        )}
                        {translation.retranslateReason && (
                          <div className="text-xs text-muted-foreground">
                            Feedback: {translation.retranslateReason}
                          </div>
                        )}
                      </div>
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
          availableTranslations.length === 0 &&
          failedTranslations.length === 0 && (
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
      </CardContent>
    </Card>
  );
}
