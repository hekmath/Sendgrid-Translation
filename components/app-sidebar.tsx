'use client';

import type { SendGridTemplate } from '@/lib/types/sendgrid';
import { TemplateList } from '@/components/template-list';
import { UserMenu } from '@/components/user-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar';

interface AppSidebarProps {
  templates: SendGridTemplate[];
}

export function AppSidebar({ templates }: AppSidebarProps) {
  return (
    <Sidebar className="border-r border-sidebar-border/60">
      <SidebarHeader className="gap-2 px-2 pb-0">
        <div className="flex items-center gap-2 rounded-md px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-foreground/10 text-sm font-semibold uppercase">
            un
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              unsend
            </p>
            <p className="text-xs text-sidebar-foreground/70">
              made by hekmat :)
            </p>
          </div>
        </div>
        <SidebarSeparator />
      </SidebarHeader>

      <SidebarContent className="px-1 overflow-x-hidden">
        <TemplateList templates={templates} />
      </SidebarContent>

      <SidebarFooter className="mt-auto px-2 pb-2">
        <UserMenu placement="sidebar" />
      </SidebarFooter>
    </Sidebar>
  );
}
