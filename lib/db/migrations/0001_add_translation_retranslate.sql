ALTER TABLE template_translations
  ADD COLUMN retranslate_reason text,
  ADD COLUMN retranslate_attempts integer NOT NULL DEFAULT 0;
