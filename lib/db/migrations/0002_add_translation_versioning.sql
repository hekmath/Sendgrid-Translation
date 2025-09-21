ALTER TABLE template_translations
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN verified_at timestamp,
  ADD COLUMN deleted_at timestamp;

-- Ensure all existing rows get version 1 explicitly set for future default removal if needed
UPDATE template_translations SET version = 1 WHERE version IS NULL;
