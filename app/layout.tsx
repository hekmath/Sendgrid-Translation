import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Analytics } from '@vercel/analytics/next';
import { QueryProvider } from '@/providers/query-provider';
import { TranslationActivityDrawer } from '@/components/translation-activity-drawer';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Keeper Fluent Templates',
  description: 'Manage and translate SendGrid templates',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <QueryProvider>
          {children}
          <TranslationActivityDrawer />
          <Toaster />
        </QueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
