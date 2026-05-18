-- Ensure kr_id column exists on tasks (idempotent — safe to run even if 036 was already applied)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS kr_id uuid REFERENCES public.okr_key_results(id) ON DELETE SET NULL;

-- Index for fast subtask lookups by key result
CREATE INDEX IF NOT EXISTS tasks_kr_id_idx ON public.tasks(kr_id) WHERE kr_id IS NOT NULL;
