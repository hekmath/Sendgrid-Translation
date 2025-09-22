import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import {
  translateLanguage,
  retranslateLanguage,
} from '@/inngest/translation-worker';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [translateLanguage, retranslateLanguage],
});
