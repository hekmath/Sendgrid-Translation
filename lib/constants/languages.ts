export const LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
  },
  'en-GB': {
    code: 'en-GB',
    name: 'English (UK)',
    nativeName: 'English (UK)',
  },
  'fr-CA': {
    code: 'fr-CA',
    name: 'French (Quebec)',
    nativeName: 'Français (Québec)',
  },
  vi: {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
  },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;
export type Language = (typeof LANGUAGES)[LanguageCode];

export const SUPPORTED_LANGUAGES = Object.values(LANGUAGES);
export const TARGET_LANGUAGES = Object.values(LANGUAGES).filter(
  (lang) => lang.code !== 'en'
);

export function getLanguageByCode(code: string): Language | undefined {
  return LANGUAGES[code as LanguageCode];
}
