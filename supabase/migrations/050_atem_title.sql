-- Migration 050: Add title field to atem_items for a short friendly name
ALTER TABLE public.atem_items ADD COLUMN IF NOT EXISTS title text;
