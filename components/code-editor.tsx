'use client';

import { useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Code,
  Search,
  Copy,
  Check,
  FileCode,
  Type,
  Hash,
  Eye,
  EyeOff,
} from 'lucide-react';

interface CodeEditorProps {
  htmlContent: string;
  subject: string;
}

interface CodeStats {
  characters: number;
  lines: number;
  variables: number;
  elements: number;
}

export function CodeEditor({ htmlContent, subject }: CodeEditorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [copied, setCopied] = useState(false);

  const formattedHTML = useMemo(() => {
    if (!htmlContent.trim()) return '';

    // Basic HTML formatting for better readability
    let formatted = htmlContent
      .replace(/></g, '>\n<')
      .replace(/\{\{/g, '\n{{')
      .replace(/\}\}/g, '}}\n')
      .replace(/\s*\n\s*/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join('\n');

    // Proper indentation
    const lines = formatted.split('\n');
    let indentLevel = 0;
    const indentedLines = lines.map((line) => {
      const trimmedLine = line.trim();

      // Decrease indent for closing tags
      if (trimmedLine.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indentedLine = '  '.repeat(indentLevel) + trimmedLine;

      // Increase indent for opening tags (but not self-closing)
      if (
        trimmedLine.startsWith('<') &&
        !trimmedLine.startsWith('</') &&
        !trimmedLine.endsWith('/>') &&
        !trimmedLine.startsWith('<!') &&
        !trimmedLine.startsWith('{{')
      ) {
        indentLevel++;
      }

      return indentedLine;
    });

    return indentedLines.join('\n');
  }, [htmlContent]);

  const highlightedHTML = useMemo(() => {
    if (!formattedHTML) return '';

    let highlighted = formattedHTML;

    // Escape HTML first
    highlighted = highlighted
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight HTML tags
    highlighted = highlighted.replace(
      /(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)(.*?)(&gt;)/g,
      '<span class="text-blue-600 dark:text-blue-400">$1</span>' +
        '<span class="text-red-600 dark:text-red-400 font-semibold">$2</span>' +
        '<span class="text-green-600 dark:text-green-400">$3</span>' +
        '<span class="text-blue-600 dark:text-blue-400">$4</span>'
    );

    // Highlight Handlebars variables
    highlighted = highlighted.replace(
      /(\{\{[^}]*\}\})/g,
      '<span class="text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950 px-1 rounded">$1</span>'
    );

    // Highlight attributes
    highlighted = highlighted.replace(
      /(\w+)=("[^"]*"|'[^']*')/g,
      '<span class="text-orange-600 dark:text-orange-400">$1</span>=<span class="text-green-700 dark:text-green-300">$2</span>'
    );

    // Apply search highlighting if there's a search term
    if (searchTerm.trim()) {
      const searchRegex = new RegExp(
        `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
        'gi'
      );
      highlighted = highlighted.replace(
        searchRegex,
        '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>'
      );
    }

    return highlighted;
  }, [formattedHTML, searchTerm]);

  const codeStats = useMemo((): CodeStats => {
    const characters = htmlContent.length;
    const lines = formattedHTML.split('\n').length;
    const variables = (htmlContent.match(/\{\{[^}]+\}\}/g) || []).length;
    const elements = (htmlContent.match(/<[^/!][^>]*>/g) || []).length;

    return { characters, lines, variables, elements };
  }, [htmlContent, formattedHTML]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formattedHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [formattedHTML]);

  const lines = useMemo(() => {
    return highlightedHTML.split('\n');
  }, [highlightedHTML]);

  if (!htmlContent.trim()) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
            <FileCode className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Content</h3>
          <p className="text-muted-foreground">
            This template version has no HTML content to display.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border/60 bg-card/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Template Code</h3>
            <Badge variant="secondary" className="text-xs">
              HTML
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLineNumbers(!showLineNumbers)}
            >
              {showLineNumbers ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">
                {showLineNumbers ? 'Hide' : 'Show'} Numbers
              </span>
            </Button>

            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </Button>
          </div>
        </div>

        {/* Subject Display */}
        {subject && (
          <div className="mb-3 p-2 bg-muted/50 rounded-lg">
            <div className="text-xs text-muted-foreground mb-1">
              Email Subject:
            </div>
            <div className="text-sm font-medium">{subject}</div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Type className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Characters:</span>
            <span className="font-medium">
              {codeStats.characters.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Hash className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Lines:</span>
            <span className="font-medium">{codeStats.lines}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Code className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Variables:</span>
            <span className="font-medium">{codeStats.variables}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <FileCode className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Elements:</span>
            <span className="font-medium">{codeStats.elements}</span>
          </div>
        </div>
      </div>

      {/* Code Content */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <Card className="border-none shadow-none bg-muted/20">
              <CardContent className="p-0">
                <div className="relative">
                  <pre className="text-sm font-mono leading-relaxed overflow-x-auto">
                    <code className="block">
                      {lines.map((line, index) => (
                        <div
                          key={index}
                          className="flex group hover:bg-muted/30 min-h-[1.5rem]"
                        >
                          {showLineNumbers && (
                            <span className="inline-block w-12 text-right pr-4 text-muted-foreground text-xs leading-relaxed select-none border-r border-border/30 mr-4 group-hover:text-foreground/70">
                              {index + 1}
                            </span>
                          )}
                          <span
                            className="flex-1 leading-relaxed"
                            dangerouslySetInnerHTML={{
                              __html: line || '&nbsp;',
                            }}
                          />
                        </div>
                      ))}
                    </code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
