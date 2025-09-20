'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  TARGET_LANGUAGES,
  type LanguageCode,
  type Language,
} from '@/lib/constants/languages';

interface SimpleLanguageSelectProps {
  selectedLanguages: LanguageCode[];
  onSelectionChange: (languages: LanguageCode[]) => void;
  disabled?: boolean;
}

export function SimpleLanguageSelect({
  selectedLanguages,
  onSelectionChange,
  disabled = false,
}: SimpleLanguageSelectProps) {
  const [currentSelection, setCurrentSelection] = useState<string>('');

  const handleSelect = (languageCode: string) => {
    if (
      languageCode &&
      !selectedLanguages.includes(languageCode as LanguageCode)
    ) {
      onSelectionChange([...selectedLanguages, languageCode as LanguageCode]);
      setCurrentSelection('');
    }
  };

  const handleRemove = (languageCode: LanguageCode) => {
    onSelectionChange(
      selectedLanguages.filter((code) => code !== languageCode)
    );
  };

  const availableLanguages = TARGET_LANGUAGES.filter(
    (lang) => !selectedLanguages.includes(lang.code)
  );

  const selectedLanguageObjects = selectedLanguages
    .map((code) => TARGET_LANGUAGES.find((lang) => lang.code === code))
    .filter(Boolean) as Language[];

  return (
    <div className="space-y-3">
      <Select
        value={currentSelection}
        onValueChange={handleSelect}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a language to add..." />
        </SelectTrigger>
        <SelectContent>
          {availableLanguages.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              <div className="flex flex-col">
                <span>{language.name}</span>
                <span className="text-xs text-muted-foreground">
                  {language.nativeName}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedLanguageObjects.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Selected Languages:</p>
          <div className="flex flex-wrap gap-2">
            {selectedLanguageObjects.map((language) => (
              <Badge
                key={language.code}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {language.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => handleRemove(language.code)}
                  disabled={disabled}
                  type="button"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
