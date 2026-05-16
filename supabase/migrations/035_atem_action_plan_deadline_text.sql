-- Add deadline_text (free text D column) and action_plan (rich text) to atem_items
-- The existing `deadline` column is repurposed as "Nearest Deadline" (date for reminder/countdown)

ALTER TABLE atem_items
  ADD COLUMN IF NOT EXISTS deadline_text text,
  ADD COLUMN IF NOT EXISTS action_plan text;
