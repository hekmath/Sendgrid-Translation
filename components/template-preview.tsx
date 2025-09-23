'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Handlebars, { type HelperOptions } from 'handlebars';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye,
  Smartphone,
  Monitor,
  Tablet,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Languages,
  X,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TemplateTranslation } from '@/lib/db/schema';
import { getLanguageByCode } from '@/lib/constants/languages';

interface ParsedTestData {
  [key: string]: string | number | boolean | ParsedTestData;
}

interface TemplatePreviewProps {
  htmlContent: string;
  subject: string;
  testData: ParsedTestData;
  translation?: TemplateTranslation | null;
  onClearTranslation?: () => void;
}

interface EnvState {
  values: Record<string, string>;
  loading: boolean;
  error: string;
  keys: string[];
}

type ViewMode = 'desktop' | 'tablet' | 'mobile';

const ENV_PLACEHOLDER_REGEX =
  /\{\{\s*env\s+(?:(?:"([^"]+)")|(?:'([^']+)')|([^\s}]+))\s*\}\}/g;

const extractEnvKeys = (html: string): string[] => {
  const keys = new Set<string>();
  let match;
  const regex = new RegExp(ENV_PLACEHOLDER_REGEX.source, 'g');

  while ((match = regex.exec(html)) !== null) {
    const key = match[1] || match[2] || match[3];
    if (key?.trim()) {
      keys.add(key.trim());
    }
  }

  return Array.from(keys);
};

const equalsHelper = function (
  this: unknown,
  a: unknown,
  b: unknown,
  options?: HelperOptions
) {
  const result = a === b;
  if (options && typeof options.fn === 'function') {
    return result ? options.fn(this) : options.inverse(this);
  }
  return result;
};

const notEqualsHelper = function (
  this: unknown,
  a: unknown,
  b: unknown,
  options?: HelperOptions
) {
  const result = a !== b;
  if (options && typeof options.fn === 'function') {
    return result ? options.fn(this) : options.inverse(this);
  }
  return result;
};

const insertHelper = function (partialName: unknown) {
  const label =
    typeof partialName === 'string' && partialName.trim()
      ? partialName.trim()
      : undefined;

  const escaped = label ? Handlebars.escapeExpression(label) : undefined;
  const message = label
    ? `Missing SendGrid partial: ${escaped}`
    : 'Missing SendGrid partial';

  const markup = `
    <div style="border: 1px dashed #d1d5db; background: #f8fafc; color: #475569; padding: 12px; margin: 12px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; font-size: 13px; border-radius: 6px;">
      <strong>${message}</strong>
      <div style="margin-top:4px; font-size: 12px; color: #64748b;">
        Preview placeholder for SendGrid {{{insert}}} helper${escaped ? `: <code>${escaped}</code>` : ''}
      </div>
    </div>
  `;

  return new Handlebars.SafeString(markup);
};

const buildDocumentMarkup = (html: string): string => {
  const trimmed = html.trim();

  if (!trimmed) {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; 
        padding: 48px; 
        color: #374151;
        background: #f9fafb;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
      }
      .empty-state {
        text-align: center;
        color: #6b7280;
      }
    </style>
  </head>
  <body>
    <div class="empty-state">
      <h3>No content to preview</h3>
      <p>This template appears to be empty.</p>
    </div>
  </body>
</html>`;
  }

  if (/^<!DOCTYPE html>/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    return trimmed;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { 
        margin: 0; 
        background-color: #f8fafc; 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      }
    </style>
  </head>
  <body>
    ${trimmed}
  </body>
</html>`;
};

const VIEWPORT_CONFIG = {
  desktop: { width: 'max-w-[1200px]', label: 'Desktop', icon: Monitor },
  tablet: { width: 'max-w-[768px]', label: 'Tablet', icon: Tablet },
  mobile: { width: 'max-w-[390px]', label: 'Mobile', icon: Smartphone },
} as const;

export function TemplatePreview({
  htmlContent,
  subject,
  testData,
  translation,
  onClearTranslation,
}: TemplatePreviewProps) {
  const [renderedHTML, setRenderedHTML] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('desktop');
  const [compilationError, setCompilationError] = useState('');
  const [contentMode, setContentMode] = useState<'original' | 'translation'>(
    'original'
  );

  const [envState, setEnvState] = useState<EnvState>({
    values: {},
    loading: false,
    error: '',
    keys: [],
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fetchedEnvKeysRef = useRef<Set<string>>(new Set());

  const translationLanguage = translation
    ? getLanguageByCode(translation.languageCode)
    : undefined;

  const translationLanguageName = translation
    ? translationLanguage?.name ?? translation.languageCode.toUpperCase()
    : undefined;

  const translationLanguageNativeName = translation
    ? translationLanguage?.nativeName ?? translationLanguageName
    : undefined;

  const isTranslationAvailable = Boolean(
    translation?.status === 'completed' &&
      translation.translatedHtml &&
      translation.translatedHtml.trim().length > 0
  );

  useEffect(() => {
    if (translation?.id && isTranslationAvailable) {
      setContentMode('translation');
    } else {
      setContentMode('original');
    }
  }, [translation?.id, isTranslationAvailable]);

  const showTranslation =
    contentMode === 'translation' && isTranslationAvailable;

  const translationInProgress = Boolean(
    translation && translation.status !== 'completed'
  );

  const activeHtml = useMemo(() => {
    if (showTranslation && translation?.translatedHtml) {
      return translation.translatedHtml;
    }
    return htmlContent;
  }, [showTranslation, translation?.translatedHtml, htmlContent]);

  const activeSubject = useMemo(() => {
    if (showTranslation && translation) {
      return translation.translatedSubject || subject;
    }
    return subject;
  }, [showTranslation, translation?.translatedSubject, translation, subject]);

  const translationLabel = translation
    ? translationLanguageName || 'Translation'
    : 'Translation';

  const envKeys = useMemo(() => extractEnvKeys(activeHtml), [activeHtml]);

  const compiledTemplate = useMemo(() => {
    try {
      setCompilationError('');
      return Handlebars.compile(activeHtml);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Template compilation failed';
      setCompilationError(errorMessage);
      console.error('Failed to compile template:', error);
      return null;
    }
  }, [activeHtml]);

  // Reset env state when keys change
  useEffect(() => {
    if (JSON.stringify(envKeys) !== JSON.stringify(envState.keys)) {
      fetchedEnvKeysRef.current = new Set();
      setEnvState((prev) => ({
        ...prev,
        keys: envKeys,
        error: '',
        values: envKeys.length === 0 ? {} : prev.values,
      }));
    }
  }, [envKeys, envState.keys]);

  const fetchEnvValues = useCallback(async (keys: string[]) => {
    if (!keys.length) return;

    setEnvState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch('/api/sendgrid/env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys }),
      });

      if (!response.ok) {
        throw new Error('Failed to resolve environment variables');
      }

      const data = await response.json();

      setEnvState((prev) => ({
        ...prev,
        loading: false,
        values: { ...prev.values, ...(data?.result || {}) },
        error:
          data?.rejected?.length > 0
            ? `Some variables unavailable: ${data.rejected.join(', ')}`
            : '',
      }));

      keys.forEach((key) => fetchedEnvKeysRef.current.add(key));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Environment fetch failed';
      setEnvState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Fetch missing environment variables
  useEffect(() => {
    const keysToFetch = envKeys.filter(
      (key) => !fetchedEnvKeysRef.current.has(key)
    );
    if (keysToFetch.length > 0) {
      void fetchEnvValues(keysToFetch);
    }
  }, [envKeys, fetchEnvValues]);

  const context = useMemo(() => {
    const base = { ...testData };

    // Handle env values - ensure they're all strings
    const existingEnv =
      base.env && typeof base.env === 'object'
        ? Object.fromEntries(
            Object.entries(base.env as Record<string, unknown>).map(
              ([key, value]) => [
                key,
                typeof value === 'string' ? value : String(value || ''),
              ]
            )
          )
        : {};

    base.env = { ...envState.values, ...existingEnv };
    return base;
  }, [testData, envState.values]);

  const resolveEnvValue = useCallback(
    (rawKey: unknown): string => {
      if (typeof rawKey !== 'string') return '';

      const key = rawKey.trim();
      if (!key) return '';

      const envSource = context.env as Record<string, unknown> | undefined;
      return envSource && envSource[key] !== undefined
        ? String(envSource[key] ?? '')
        : '';
    },
    [context]
  );

  const refreshPreview = useCallback(
    (options?: { reloadEnv?: boolean }) => {
      if (options?.reloadEnv && envKeys.length) {
        fetchedEnvKeysRef.current = new Set();
        setEnvState((prev) => ({ ...prev, values: {} }));
        void fetchEnvValues(envKeys);
      }

      if (!compiledTemplate) {
        setRenderedHTML(activeHtml);
        return;
      }

      try {
        const html = compiledTemplate(context, {
          helpers: {
            env: (key: unknown) => resolveEnvValue(key),
            equals: equalsHelper,
            notEquals: notEqualsHelper,
            insert: insertHelper,
          },
        });
        setRenderedHTML(html);
      } catch (error) {
        console.error('Failed to render template:', error);
        setRenderedHTML(activeHtml);
      }
    },
    [
      compiledTemplate,
      context,
      envKeys,
      fetchEnvValues,
      activeHtml,
      resolveEnvValue,
    ]
  );

  useEffect(() => {
    refreshPreview();
  }, [refreshPreview]);

  const finalMarkup = useMemo(
    () => buildDocumentMarkup(renderedHTML || activeHtml),
    [renderedHTML, activeHtml]
  );

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.srcdoc = finalMarkup;
    }
  }, [finalMarkup]);

  const openInNewTab = useCallback(() => {
    const blob = new Blob([finalMarkup], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, [finalMarkup]);

  const currentViewport = VIEWPORT_CONFIG[viewMode];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 border-b border-border/60 bg-card/50 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Live Preview</span>
            {translation && (
              <Badge
                variant={showTranslation ? 'default' : 'secondary'}
                className="text-xs"
              >
                {showTranslation
                  ? `Translation · ${translationLabel}`
                  : 'Original content'}
              </Badge>
            )}
            {translation?.version && (
              <Badge variant="outline" className="text-xs uppercase">
                v{translation.version}
              </Badge>
            )}
            {translation?.verifiedAt && (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 text-xs"
              >
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            )}
            {compilationError && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Error
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {activeSubject && (
              <span className="truncate">Subject: {activeSubject}</span>
            )}
            {translation && (
              <span className="flex items-center gap-1">
                <Languages className="h-3 w-3" />
                {translationLanguageNativeName || translationLabel}
              </span>
            )}
            {translation?.retranslateReason && (
              <span className="flex items-center gap-1 text-muted-foreground/80">
                Feedback: {translation.retranslateReason}
              </span>
            )}
            {envKeys.length > 0 && (
              <div className="flex items-center gap-1">
                {envState.loading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : envState.error ? (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                ) : (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                )}
                <span>Env vars: {envKeys.length}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {translation && (
            <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background p-1">
              <Button
                variant={contentMode === 'original' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setContentMode('original')}
                className="h-8 px-2"
              >
                Original
              </Button>
              <Button
                variant={contentMode === 'translation' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setContentMode('translation')}
                disabled={!isTranslationAvailable}
                className="h-8 px-2"
                title={
                  isTranslationAvailable
                    ? `View ${translationLabel} translation`
                    : 'Translation is still processing'
                }
              >
                <Languages className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline text-xs">
                  {translationLabel}
                </span>
              </Button>
            </div>
          )}
          {translation && onClearTranslation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearTranslation}
              className="h-8 px-2"
              title="Exit translation preview"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {/* Viewport Controls */}
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-background p-1">
            {Object.entries(VIEWPORT_CONFIG).map(([mode, config]) => {
              const Icon = config.icon;
              return (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode(mode as ViewMode)}
                  className="h-8 px-2"
                  title={config.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="ml-1 hidden sm:inline text-xs">
                    {config.label}
                  </span>
                </Button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <Button variant="outline" size="sm" onClick={openInNewTab}>
            <ExternalLink className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">Open</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshPreview({ reloadEnv: true })}
            disabled={envState.loading}
          >
            <RefreshCw
              className={`h-4 w-4 ${envState.loading ? 'animate-spin' : ''}`}
            />
            <span className="ml-1 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Error Alerts */}
      {compilationError && (
        <Alert variant="destructive" className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Template compilation error: {compilationError}
          </AlertDescription>
        </Alert>
      )}

      {envState.error && (
        <Alert variant="destructive" className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {envState.error}
          </AlertDescription>
        </Alert>
      )}

      {translation && translationInProgress && (
        <Alert variant="default" className="mx-4 mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Retranslation in progress. Showing the most recent version until
            updated copy is ready.
          </AlertDescription>
        </Alert>
      )}

      {/* Preview Content */}
      <div className="flex-1 overflow-hidden bg-muted/20 p-4">
        <Card className="flex flex-col border-none bg-transparent shadow-none">
          <CardContent className="flex flex-col overflow-hidden p-0">
            <div className="flex w-full justify-center overflow-hidden rounded-xl border border-border/70 bg-background shadow-lg">
              <div
                className={`flex w-full justify-center overflow-auto p-4 ${currentViewport.width}`}
              >
                <div className="flex w-full max-w-full items-stretch justify-center overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                  <iframe
                    ref={iframeRef}
                    className="min-h-[960px] w-full border-0"
                    title="Email Template Preview"
                    sandbox="allow-same-origin allow-forms allow-popups"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
