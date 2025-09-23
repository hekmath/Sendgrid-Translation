'use client';

import { useState, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Calendar,
  CheckCircle,
  Clock,
  Code,
  FileText,
  Filter,
  Layers,
  Mail,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

const MAX_TITLE_LENGTH = 35;

const SORT_BUTTONS: Array<{
  option: SortOption;
  label: string;
  icon: LucideIcon;
}> = [
  { option: 'updated', label: 'Updated', icon: Clock },
  { option: 'name', label: 'Name', icon: FileText },
  { option: 'versions', label: 'Versions', icon: Code },
];

const GENERATION_BUTTONS: Array<{
  option: GenerationFilter;
  label: string;
}> = [
  { option: 'all', label: 'All' },
  { option: 'dynamic', label: 'Dynamic' },
  { option: 'legacy', label: 'Legacy' },
];

export function TemplateList({ templates }: TemplateListProps) {
  const { selectedTemplate, setSelectedTemplate } = useTemplateManager();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [generationFilter, setGenerationFilter] =
    useState<GenerationFilter>('all');

  const getTemplateStats = useCallback(
    (template: SendGridTemplate): TemplateStats => {
      const activeVersion =
        template.versions.find((version) => version.active === 1) || null;
      const totalVersions = template.versions.length;
      const hasContent = template.versions.some(
        (version) => version.html_content.trim().length > 0
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

    if (generationFilter !== 'all') {
      filtered = filtered.filter((template) => {
        if (generationFilter === 'legacy') {
          return template.generation === 'legacy';
        }

        if (generationFilter === 'dynamic') {
          return template.generation === 'dynamic';
        }

        return true;
      });
    }

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
    const legacy = templates.filter(
      (template) => template.generation === 'legacy'
    ).length;
    const dynamic = templates.filter(
      (template) => template.generation === 'dynamic'
    ).length;

    return { total, legacy, dynamic };
  }, [templates]);

  const listIsEmpty = templates.length === 0;
  const noMatches = filteredAndSortedTemplates.length === 0 && !listIsEmpty;

  return (
    <div className="flex h-full flex-col">
      <SidebarGroup className="pb-0">
        <SidebarGroupLabel className="flex items-center gap-2 text-sm font-semibold">
          Templates
          <Badge variant="outline" className="ml-auto text-xs">
            {filteredAndSortedTemplates.length} of {templates.length}
          </Badge>
        </SidebarGroupLabel>
        <SidebarGroupContent className="space-y-4 px-0">
          <p className="px-2 text-xs text-sidebar-foreground/70">
            {templateCounts.dynamic} dynamic • {templateCounts.legacy} legacy
            templates
          </p>

          <div className="relative px-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/60" />
            <SidebarInput
              placeholder="Search templates..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 text-sm"
            />
          </div>

          <div className="space-y-4 px-2 text-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                <Filter className="h-3.5 w-3.5" />
                <span>Generation</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {GENERATION_BUTTONS.map(({ option, label }) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={
                      generationFilter === option ? 'default' : 'outline'
                    }
                    onClick={() => setGenerationFilter(option)}
                    className="h-8 w-full justify-center text-xs"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">
                <Layers className="h-3.5 w-3.5" />
                <span>Sort By</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {SORT_BUTTONS.map(({ option, label, icon: Icon }) => (
                  <Button
                    key={option}
                    size="sm"
                    variant={sortBy === option ? 'default' : 'outline'}
                    onClick={() => setSortBy(option)}
                    className="h-8 w-full justify-center gap-1 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mt-3" />

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="px-2 pb-4 pt-2">
            {listIsEmpty && (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed border-sidebar-border/60 bg-sidebar/40 text-center">
                <Mail className="mb-3 h-8 w-8 text-sidebar-foreground/60" />
                <p className="text-sm font-medium">No templates found</p>
                <p className="text-xs text-sidebar-foreground/70">
                  We couldn&apos;t find any templates in your SendGrid account.
                </p>
              </div>
            )}

            {noMatches && (
              <div className="flex h-40 flex-col items-center justify-center rounded-md border border-dashed border-sidebar-border/60 bg-sidebar/40 text-center">
                <Search className="mb-3 h-8 w-8 text-sidebar-foreground/60" />
                <p className="text-sm font-medium">No matches</p>
                <p className="text-xs text-sidebar-foreground/70">
                  Try adjusting your filters or search query.
                </p>
              </div>
            )}

            {!listIsEmpty && !noMatches && (
              <SidebarMenu>
                {filteredAndSortedTemplates.map((template) => {
                  const stats = getTemplateStats(template);
                  const isSelected = selectedTemplate?.id === template.id;
                  const truncatedName =
                    template.name.length > MAX_TITLE_LENGTH
                      ? `${template.name.slice(0, MAX_TITLE_LENGTH)}…`
                      : template.name;

                  return (
                    <SidebarMenuItem key={template.id}>
                      <SidebarMenuButton
                        isActive={isSelected}
                        onClick={() => setSelectedTemplate(template)}
                        className="items-start gap-3 overflow-hidden"
                        aria-label={`Select template ${template.name}`}
                      >
                        <FileText className="mt-1 h-4 w-4 text-sidebar-foreground/70" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="line-clamp-2 whitespace-normal text-sm font-medium leading-5 break-words">
                              {truncatedName}
                            </span>
                          </div>

                          <p className="line-clamp-2 text-xs text-sidebar-foreground/70">
                            {stats.activeVersion?.subject ||
                              'No subject available'}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-sidebar-foreground/60">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(template.updated_at)}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Layers className="h-3 w-3" />
                              {stats.totalVersions} versions
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              {stats.hasContent ? 'Has HTML' : 'No HTML'}
                            </span>
                          </div>
                        </div>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
