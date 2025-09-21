'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Code, Settings } from 'lucide-react';
import { TemplateList } from '@/components/template-list';
import { TemplateEditor } from '@/components/template-editor';
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@/components/ui/resizable';
import { TemplateManagerProvider } from '@/providers/template-manager-context';
import type { SendGridTemplate } from '@/lib/types/sendgrid';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SendGridTemplateManager() {
  const defaultApiKey = (process.env.NEXT_PUBLIC_SENDGRID_API_KEY || '').trim();
  const [apiKey, setApiKey] = useState(defaultApiKey);
  const [templates, setTemplates] = useState<SendGridTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<SendGridTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const autoConfigureRef = useRef(false);

  const fetchTemplates = useCallback(
    async (override?: string) => {
      const resolvedKey = (override ?? apiKey ?? '').trim() || defaultApiKey;

      if (!resolvedKey) {
        setError('Please provide a SendGrid API key');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const payload =
          resolvedKey === defaultApiKey ? {} : { apiKey: resolvedKey };
        const response = await fetch('/api/sendgrid/templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch templates');
        }

        const data = await response.json();
        const fetchedTemplates: SendGridTemplate[] = data.result || [];
        setTemplates(fetchedTemplates);
        setSelectedTemplate((current) => {
          if (current) {
            const updated = fetchedTemplates.find((t) => t.id === current.id);
            if (updated) {
              return updated;
            }
          }
          return fetchedTemplates[0] ?? null;
        });
        setIsConfigured(true);
        setApiKey(resolvedKey);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch templates'
        );
      } finally {
        setLoading(false);
      }
    },
    [apiKey, defaultApiKey]
  );

  useEffect(() => {
    if (!defaultApiKey || autoConfigureRef.current) {
      return;
    }

    autoConfigureRef.current = true;
    void fetchTemplates(defaultApiKey);
  }, [defaultApiKey, fetchTemplates]);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Keeper Fluent Templates
            </h1>
            <p className="text-muted-foreground">
              Connect to your SendGrid account to manage and preview your email
              templates
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configure SendGrid API
              </CardTitle>
              <CardDescription>
                Enter your SendGrid API key to get started. Make sure it has
                template read permissions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey">SendGrid API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="SG.xxxxxxxxxxxxxxxx"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              {defaultApiKey && (
                <p className="text-xs text-muted-foreground">
                  Loaded from{' '}
                  <code className="rounded bg-muted px-1">
                    NEXT_PUBLIC_SENDGRID_API_KEY
                  </code>
                  . Enter a value to override for this session.
                </p>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={() => fetchTemplates(apiKey || defaultApiKey)}
                disabled={loading || !(apiKey || defaultApiKey)}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect to SendGrid'
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <TemplateManagerProvider value={{ selectedTemplate, setSelectedTemplate }}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Keeper Fluent Templates
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    {templates.length} templates loaded
                  </p>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="container mx-auto p-6">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-[calc(100vh-200px)] rounded-lg border border-border bg-card/30 backdrop-blur-sm"
          >
            <ResizablePanel
              defaultSize={28}
              minSize={18}
              className="overflow-hidden border-r border-border/70"
            >
              <TemplateList templates={templates} />
            </ResizablePanel>
            <ResizableHandle className="relative w-3 cursor-col-resize border-r border-border/70">
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-12 w-[2px] rounded-full bg-border" />
              </div>
            </ResizableHandle>
            <ResizablePanel
              defaultSize={72}
              minSize={45}
              className="overflow-hidden"
            >
              {selectedTemplate ? (
                <TemplateEditor apiKey={apiKey || defaultApiKey} />
              ) : (
                <Card className="flex h-full items-center justify-center border-none bg-transparent shadow-none">
                  <CardContent className="text-center">
                    <Code className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                      Select a Template
                    </h3>
                    <p className="text-muted-foreground">
                      Choose a template from the list to view its code and
                      preview
                    </p>
                  </CardContent>
                </Card>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </TemplateManagerProvider>
  );
}
