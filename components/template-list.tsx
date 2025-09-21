'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Mail,
  Calendar,
  Layers,
  Search,
  Filter,
  CheckCircle,
  FileText,
  Clock,
  Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTemplateManager } from '@/providers/template-manager-context';
import type { SendGridTemplate } from '@/lib/types/sendgrid';

interface TemplateListProps {
  templates: SendGridTemplate[];
}

type SortOption = 'name' | 'updated' | 'versions';
type GenerationFilter = 'all' | 'legacy' | 'dynamic';

interface TemplateStats {
  activeVersion: SendGridTemplate['versions'][number] | null;
  totalVersions: number;
  hasContent: boolean;
  lastModified: Date;
}

export function TemplateList({ templates }: TemplateListProps) {
  const { selectedTemplate, setSelectedTemplate } = useTemplateManager();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [generationFilter, setGenerationFilter] =
    useState<GenerationFilter>('all');

  const getTemplateStats = useCallback(
    (template: SendGridTemplate): TemplateStats => {
      const activeVersion =
        template.versions.find((v) => v.active === 1) || null;
      const totalVersions = template.versions.length;
      const hasContent = template.versions.some(
        (v) => v.html_content.trim().length > 0
      );
      const lastModified = new Date(template.updated_at);

      return {
        activeVersion,
        totalVersions,
        hasContent,
        lastModified,
      };
    },
    []
  );

  const filteredAndSortedTemplates = useMemo(() => {
    let filtered = [...templates];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((template) => {
        const stats = getTemplateStats(template);
        const matchesName = template.name.toLowerCase().includes(search);
        const matchesId = template.id.toLowerCase().includes(search);
        const matchesActiveSubject = stats.activeVersion?.subject
          ?.toLowerCase()
          .includes(search);
        const matchesVersionName = template.versions.some((version) =>
          version.name.toLowerCase().includes(search)
        );

        return (
          matchesName ||
          matchesId ||
          Boolean(matchesActiveSubject) ||
          matchesVersionName
        );
      });
    }

    // Apply generation filter
    if (generationFilter !== 'all') {
      filtered = filtered.filter((template) => {
        if (generationFilter === 'legacy') {
          return template.generation === 'legacy';
        } else if (generationFilter === 'dynamic') {
          return template.generation === 'dynamic';
        }
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updated':
          return (
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          );
        case 'versions':
          return b.versions.length - a.versions.length;
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchTerm, sortBy, generationFilter, getTemplateStats]);

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }, []);

  const getGenerationColor = useCallback((generation: string) => {
    return generation === 'dynamic' ? 'default' : 'secondary';
  }, []);

  const templateCounts = useMemo(() => {
    const total = templates.length;
    const legacy = templates.filter((t) => t.generation === 'legacy').length;
    const dynamic = templates.filter((t) => t.generation === 'dynamic').length;
    return { total, legacy, dynamic };
  }, [templates]);

  if (templates.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-muted rounded-full mb-4">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
          <p className="text-muted-foreground max-w-sm">
            No SendGrid templates are available in your account, or they
            couldn't be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Card className="flex h-full flex-col border-none bg-transparent shadow-none">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Templates</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredAndSortedTemplates.length} of {templates.length}
          </Badge>
        </div>

        <CardDescription className="text-sm">
          {templateCounts.dynamic} dynamic, {templateCounts.legacy} legacy
          templates
        </CardDescription>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center gap-1">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Filter:</span>
          </div>

          <div className="flex items-center gap-1">
            {(['all', 'dynamic', 'legacy'] as const).map((filter) => (
              <Button
                key={filter}
                variant={generationFilter === filter ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setGenerationFilter(filter)}
                className="h-7 px-2 text-xs"
              >
                {filter === 'all'
                  ? 'All'
                  : filter === 'dynamic'
                  ? 'Dynamic'
                  : 'Legacy'}
              </Button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Sort by:</span>
          <div className="flex items-center gap-1">
            {(
              [
                { key: 'updated', label: 'Updated', icon: Clock },
                { key: 'name', label: 'Name', icon: FileText },
                { key: 'versions', label: 'Versions', icon: Layers },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={sortBy === key ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSortBy(key)}
                className="h-7 px-2 text-xs"
              >
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-2 p-4 pr-6">
            {filteredAndSortedTemplates.map((template) => {
              const stats = getTemplateStats(template);
              const isSelected = selectedTemplate?.id === template.id;

              return (
                <div
                  key={template.id}
                  className={cn(
                    'p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md',
                    isSelected
                      ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary/20'
                      : 'bg-card border-border hover:bg-accent/50 hover:border-accent-foreground/20'
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-foreground line-clamp-2 mb-1">
                          {template.name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant={getGenerationColor(template.generation)}
                            className="text-xs"
                          >
                            {template.generation}
                          </Badge>
                          {stats.activeVersion && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span className="text-xs text-green-600">
                                Active
                              </span>
                            </div>
                          )}
                          {!stats.hasContent && (
                            <Badge
                              variant="outline"
                              className="text-xs text-orange-600"
                            >
                              Empty
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Content Preview */}
                    {stats.activeVersion?.subject && (
                      <div className="text-xs text-muted-foreground line-clamp-1">
                        <span className="font-medium">Subject:</span>{' '}
                        {stats.activeVersion.subject}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(template.updated_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {stats.totalVersions} version
                          {stats.totalVersions !== 1 ? 's' : ''}
                        </div>
                        {stats.hasContent && (
                          <div className="flex items-center gap-1">
                            <Code className="h-3 w-3" />
                            <span>Content</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Version Info */}
                    {stats.activeVersion && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Active:</span>{' '}
                        {stats.activeVersion.name}
                        {stats.activeVersion.editor && (
                          <span className="ml-2">
                            • by {stats.activeVersion.editor}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredAndSortedTemplates.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-muted rounded-full mb-3">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <h4 className="font-medium mb-1">No templates found</h4>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
