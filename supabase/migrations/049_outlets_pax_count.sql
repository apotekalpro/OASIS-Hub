-- Add pax_count to outlets for Alproean headcount (used in incentive calculations)
ALTER TABLE outlets ADD COLUMN IF NOT EXISTS pax_count integer NOT NULL DEFAULT 1;
