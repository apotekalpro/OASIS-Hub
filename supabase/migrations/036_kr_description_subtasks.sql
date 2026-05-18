-- Add description field to okr_key_results
ALTER TABLE okr_key_results ADD COLUMN IF NOT EXISTS description text;

-- Add kr_id foreign key to tasks table so tasks can be linked to a key result
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS kr_id uuid REFERENCES okr_key_results(id) ON DELETE SET NULL;
