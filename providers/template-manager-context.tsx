'use client';

import { createContext, useContext } from 'react';
import type { SendGridTemplate } from '@/lib/types/sendgrid';

export interface TemplateManagerContextValue {
  selectedTemplate: SendGridTemplate | null;
  setSelectedTemplate: (template: SendGridTemplate | null) => void;
}

const TemplateManagerContext =
  createContext<TemplateManagerContextValue | undefined>(undefined);

export function TemplateManagerProvider({
  value,
  children,
}: {
  value: TemplateManagerContextValue;
  children: React.ReactNode;
}) {
  return (
    <TemplateManagerContext.Provider value={value}>
      {children}
    </TemplateManagerContext.Provider>
  );
}

export function useTemplateManager() {
  const context = useContext(TemplateManagerContext);
  if (!context) {
    throw new Error(
      'useTemplateManager must be used within a TemplateManagerProvider'
    );
  }
  return context;
}
