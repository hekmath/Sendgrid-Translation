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

  const completedTranslations = useMemo(
    () =>
      translationsForVersion.filter((translation) =>
        translation.status === 'completed'
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

        {/* Completed Translations */}
        {completedTranslations.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Available Translations</h4>
            <div className="space-y-2">
              {completedTranslations.map((translation) => {
                const language = getLanguageByCode(translation.languageCode);
                const isSelected = selectedTranslationId === translation.id;
                return (
                  <div
                    key={translation.id}
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      isSelected
                        ? 'border-primary/60 bg-primary/5 shadow-sm'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="font-medium text-sm">
                          {language?.name || translation.languageCode}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {language?.nativeName}
                          {isSelected && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              Previewing
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant={isSelected ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onTranslationSelect?.(translation)}
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
          completedTranslations.length === 0 &&
          failedTranslations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Languages className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No translations yet</p>
              <p className="text-xs">Select languages above to get started</p>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
