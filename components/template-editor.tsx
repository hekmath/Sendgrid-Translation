'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Code, Eye, FileText, Calendar, User, Languages } from 'lucide-react';
import { CodeEditor } from '@/components/code-editor';
import { TemplatePreview } from '@/components/template-preview';
import { TranslationPanel } from '@/components/translation-panel';
import type { TemplateTranslation } from '@/lib/db/schema';
import { useTemplateManager } from '@/providers/template-manager-context';
import type { SendGridTemplate } from '@/lib/types/sendgrid';

interface TemplateEditorProps {
  apiKey: string;
}

interface ParsedTestData {
  [key: string]: string | number | boolean | ParsedTestData;
}

export function TemplateEditor({ apiKey }: TemplateEditorProps) {
  const { selectedTemplate } = useTemplateManager();
  const template = selectedTemplate;

  const [activeVersion, setActiveVersion] =
    useState<SendGridTemplate['versions'][number] | null>(null);
  const [testData, setTestData] = useState<ParsedTestData>({});
  const [activeTab, setActiveTab] = useState('preview');
  const [selectedTranslation, setSelectedTranslation] =
    useState<TemplateTranslation | null>(null);

  // Initialize active version
  useEffect(() => {
    if (!template) {
      setActiveVersion(null);
      return;
    }

    const defaultVersion =
      template.versions.find((v) => v.active === 1) || template.versions[0];
    setActiveVersion(defaultVersion || null);
  }, [template]);

  // Parse and initialize test data when version changes
  useEffect(() => {
    if (!activeVersion) return;

    let parsedData: ParsedTestData = {};

    // First try to parse existing test_data
    if (activeVersion.test_data) {
      try {
        const parsed = JSON.parse(activeVersion.test_data);
        if (parsed && typeof parsed === 'object') {
          parsedData = parsed;
        }
      } catch (error) {
        console.warn('Failed to parse test_data:', error);
      }
    }

    // If no valid test data, extract variables from HTML and create defaults
    if (Object.keys(parsedData).length === 0) {
      const variables = extractVariablesFromHTML(activeVersion.html_content);
      variables.forEach((variable) => {
        const cleanVar = variable.split('.')[0];
        if (!parsedData[cleanVar]) {
          parsedData[cleanVar] = generateDefaultValue(variable);
        }
      });
    }

    setTestData(parsedData);
  }, [activeVersion]);

  useEffect(() => {
    setSelectedTranslation(null);
  }, [activeVersion?.id]);

  const extractVariablesFromHTML = useCallback((html: string): string[] => {
    const regex = /\{\{\s*([^}]+)\s*\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(html)) !== null) {
      const variable = match[1].trim();
      // Remove helpers and get just the variable name
      const cleanVariable = variable.replace(/^(#|\/)?(\w+).*/, '$2');
      if (
        cleanVariable &&
        !['if', 'unless', 'each', 'with'].includes(cleanVariable)
      ) {
        variables.add(variable);
      }
    }

    return Array.from(variables);
  }, []);

  const generateDefaultValue = useCallback((variable: string): string => {
    const lowerVar = variable.toLowerCase();

    if (lowerVar.includes('name')) return 'John Doe';
    if (lowerVar.includes('email')) return 'john.doe@example.com';
    if (lowerVar.includes('company')) return 'Acme Corp';
    if (lowerVar.includes('date')) return new Date().toLocaleDateString();
    if (lowerVar.includes('url') || lowerVar.includes('link'))
      return 'https://example.com';
    if (lowerVar.includes('phone')) return '+1 (555) 123-4567';
    if (lowerVar.includes('address')) return '123 Main St, Anytown, ST 12345';
    if (lowerVar.includes('amount') || lowerVar.includes('price'))
      return '$99.99';
    if (lowerVar.includes('count') || lowerVar.includes('number')) return '42';

    return `Sample ${variable}`;
  }, []);

  const handleTestDataChange = useCallback((newData: ParsedTestData) => {
    setTestData(newData);
  }, []);

  const handleVersionChange = useCallback(
    (versionId: string) => {
      if (!template) return;
      const version = template.versions.find((v) => v.id === versionId);
      if (version) {
        setActiveVersion(version);
      }
    },
    [template]
  );

  const handleTranslationSelect = useCallback(
    (translation: TemplateTranslation | null) => {
      setSelectedTranslation(translation);
      if (translation) {
        setActiveTab('preview');
      }
    },
    []
  );

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const tabConfig = useMemo(
    () => [
      { value: 'preview', label: 'Preview', icon: Eye },
      { value: 'code', label: 'Code', icon: Code },
      { value: 'translations', label: 'Translations', icon: Languages },
    ],
    []
  );

  if (!template) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Template</h3>
          <p className="text-muted-foreground">
            Choose a template from the list to load its versions and translations.
          </p>
        </div>
      </div>
    );
  }

  if (!activeVersion) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Template Version</h3>
          <p className="text-muted-foreground">
            This template has no versions available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Template Header */}
      <Card className="m-4 mb-2">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">
                {template.name}
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  variant={activeVersion.active === 1 ? 'default' : 'secondary'}
                >
                  {activeVersion.active === 1 ? 'Active' : 'Draft'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {template.generation}
                </Badge>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {formatDate(activeVersion.updated_at)}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  {activeVersion.editor}
                </div>
              </div>
            </div>

            {template.versions.length > 1 && (
              <div className="ml-4">
                <Select
                  value={activeVersion.id}
                  onValueChange={handleVersionChange}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {template.versions.map((version) => (
                      <SelectItem key={version.id} value={version.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{version.name}</span>
                          {version.active === 1 && (
                            <Badge variant="default" className="ml-2 text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Card className="flex-1 mx-4 mb-4 overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="h-full flex flex-col"
        >
          <CardHeader className="pb-2">
            <TabsList className="grid w-full grid-cols-3 h-10">
              {tabConfig.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="flex items-center gap-2 text-sm"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <TabsContent value="preview" className="h-full m-0">
              <TemplatePreview
                htmlContent={activeVersion.html_content}
                subject={activeVersion.subject}
                testData={testData}
                translation={selectedTranslation}
                onClearTranslation={() => setSelectedTranslation(null)}
              />
            </TabsContent>

            <TabsContent value="code" className="h-full m-0">
              <CodeEditor
                htmlContent={activeVersion.html_content}
                subject={activeVersion.subject}
                translation={selectedTranslation}
                onClearTranslation={() => setSelectedTranslation(null)}
              />
            </TabsContent>

            <TabsContent value="translations" className="h-full m-0">
              <TranslationPanel
                template={template}
                activeVersion={activeVersion}
                onTranslationSelect={handleTranslationSelect}
                selectedTranslationId={selectedTranslation?.id}
              />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
