'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  TARGET_LANGUAGES,
  type LanguageCode,
  type Language,
} from '@/lib/constants/languages';

interface LanguageMultiSelectProps {
  selectedLanguages: LanguageCode[];
  onSelectionChange: (languages: LanguageCode[]) => void;
  disabled?: boolean;
}

export function LanguageMultiSelect({
  selectedLanguages,
  onSelectionChange,
  disabled = false,
}: LanguageMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (languageCode: LanguageCode) => {
    if (selectedLanguages.includes(languageCode)) {
      onSelectionChange(
        selectedLanguages.filter((code) => code !== languageCode)
      );
    } else {
      onSelectionChange([...selectedLanguages, languageCode]);
    }
  };

  const handleRemove = (languageCode: LanguageCode) => {
    onSelectionChange(
      selectedLanguages.filter((code) => code !== languageCode)
    );
  };

  const selectedLanguageObjects = selectedLanguages
    .map((code) => TARGET_LANGUAGES.find((lang) => lang.code === code))
    .filter(Boolean) as Language[];

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
            type="button"
          >
            {selectedLanguages.length === 0
              ? 'Select languages...'
              : `${selectedLanguages.length} language${
                  selectedLanguages.length === 1 ? '' : 's'
                } selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search languages..." />
            <CommandList>
              <CommandEmpty>No languages found.</CommandEmpty>
              <CommandGroup>
                {TARGET_LANGUAGES.map((language) => (
                  <CommandItem
                    key={language.code}
                    value={language.name}
                    onSelect={() => handleSelect(language.code)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedLanguages.includes(language.code)
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{language.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {language.nativeName}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedLanguageObjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedLanguageObjects.map((language) => (
            <Badge key={language.code} variant="secondary" className="pr-1">
              {language.name}
              <Button
                variant="ghost"
                size="sm"
                className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                onClick={() => handleRemove(language.code)}
                disabled={disabled}
                type="button"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
