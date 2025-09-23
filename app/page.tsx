'use client';

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useUser } from '@clerk/nextjs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Code, UserX } from 'lucide-react';
import { TemplateEditor } from '@/components/template-editor';
import { TemplateManagerProvider } from '@/providers/template-manager-context';
import type { SendGridTemplate } from '@/lib/types/sendgrid';
import { AppSidebar } from '@/components/app-sidebar';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export default function SendGridTemplateManager() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [templates, setTemplates] = useState<SendGridTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<SendGridTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);
  const autoConfigureRef = useRef(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/sendgrid/templates', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch templates'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || autoConfigureRef.current) {
      return;
    }

    autoConfigureRef.current = true;
    void fetchTemplates();
  }, [isLoaded, isSignedIn, fetchTemplates]);

  const selectedTemplateMeta = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }

    const versions = selectedTemplate.versions ?? [];
    const version =
      versions.find((item) => item.active === 1) ?? versions[0] ?? null;

    const updatedAt = version?.updated_at ?? selectedTemplate.updated_at;
    let updatedText: string | null = null;

    if (updatedAt) {
      const parsedDate = new Date(updatedAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        updatedText = formatDistanceToNow(parsedDate, { addSuffix: true });
      }
    }

    return {
      version,
      updatedText,
      versionCount: versions.length,
    };
  }, [selectedTemplate]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">unsend</h1>
            <p className="text-muted-foreground">
              Sign in to access your SendGrid template manager
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Authentication Required
              </CardTitle>
              <CardDescription>
                This is an internal tool. Please sign in with your authorized
                account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => (window.location.href = '/sign-in')}
                className="w-full"
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen h-screen bg-background p-6">
        <div className="flex items-center justify-center h-full">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading templates...
            </>
          ) : (
            <Button onClick={fetchTemplates} className="w-full max-w-xs">
              Retry Loading Templates
            </Button>
          )}
        </div>
      </div>
    );
  }

  const sidebarStyles = {
    '--sidebar-width': '22rem',
    '--sidebar-width-icon': '3.75rem',
    '--sidebar-width-mobile': '22rem',
  } as CSSProperties;

  return (
    <TemplateManagerProvider value={{ selectedTemplate, setSelectedTemplate }}>
      <SidebarProvider style={sidebarStyles}>
        <AppSidebar templates={templates} />
        <SidebarInset>
          <div className="flex min-h-svh flex-col bg-background">
            <header className="border-b border-border/70 bg-card/80 backdrop-blur">
              <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
                <SidebarTrigger className="md:hidden" />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold text-foreground sm:text-2xl">
                    {selectedTemplate
                      ? selectedTemplate.name
                      : 'Select a template'}
                  </h1>
                  {selectedTemplate ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground/80"
                        title={selectedTemplate.id}
                      >
                        {selectedTemplate.id}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[11px] uppercase"
                      >
                        {selectedTemplate.generation}
                      </Badge>
                      {selectedTemplateMeta?.version && (
                        <Badge
                          variant={
                            selectedTemplateMeta.version.active === 1
                              ? 'default'
                              : 'secondary'
                          }
                          className="text-[11px]"
                        >
                          {selectedTemplateMeta.version.name}
                        </Badge>
                      )}
                      {selectedTemplateMeta && (
                        <span className="text-xs text-muted-foreground/80">
                          {selectedTemplateMeta.versionCount === 0
                            ? 'No versions'
                            : `${selectedTemplateMeta.versionCount} ${
                                selectedTemplateMeta.versionCount === 1
                                  ? 'version'
                                  : 'versions'
                              }`}
                        </span>
                      )}
                      {selectedTemplateMeta?.updatedText && (
                        <span className="text-xs text-muted-foreground/80">
                          Updated {selectedTemplateMeta.updatedText}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Choose a template from the sidebar to get started.
                    </p>
                  )}
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">
              <div className="mx-auto flex h-full max-w-6xl flex-col">
                {selectedTemplate ? (
                  <TemplateEditor />
                ) : (
                  <Card className="flex h-full items-center justify-center border-none bg-transparent shadow-none">
                    <CardContent className="text-center">
                      <Code className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 text-lg font-semibold text-foreground">
                        Select a Template
                      </h3>
                      <p className="text-muted-foreground">
                        Choose a template from the sidebar to view its code and
                        preview.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TemplateManagerProvider>
  );
}
