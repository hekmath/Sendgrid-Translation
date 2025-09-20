import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { coordinateTranslation } from '@/inngest/translation-coordinator';
import { translateLanguage } from '@/inngest/translation-worker';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [coordinateTranslation, translateLanguage],
});
