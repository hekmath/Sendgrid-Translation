'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { TemplateList } from '@/components/template-list';
import { TemplateEditor } from '@/components/template-editor';
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from '@/components/ui/resizable';
import { TemplateManagerProvider } from '@/providers/template-manager-context';
import type { SendGridTemplate } from '@/lib/types/sendgrid';
import { UserMenu } from '@/components/user-menu';

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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">unsend</h1>
            <p className="text-muted-foreground">
              Welcome {user?.firstName}! Loading your SendGrid templates...
            </p>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-center">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading templates...
                  </>
                ) : (
                  <Button onClick={fetchTemplates} className="w-full">
                    Retry Loading Templates
                  </Button>
                )}
              </div>
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
                  <h1 className="text-2xl font-bold text-foreground">unsend</h1>
                  <p className="text-sm text-muted-foreground">
                    Translate Sendgrid Email Templates
                  </p>
                </div>
              </div>
              <UserMenu />
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
                <TemplateEditor />
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
