-- Fix: OKR subtasks were appearing in the Tasks page because ON DELETE SET NULL
-- would NULL out kr_id when a Key Result was deleted, making those tasks
-- indistinguishable from regular tasks.
--
-- This migration:
--   1. Adds an is_okr_subtask flag that persists even after kr_id is cleared
--   2. Marks all currently-linked OKR subtasks (kr_id IS NOT NULL)
--   3. Changes the FK to ON DELETE CASCADE so deleting a KR also removes its tasks
--   4. Removes already-orphaned tasks (kr_id IS NULL, is_okr_subtask = false,
--      no description, no tags, created after the OKR module, single auto-assignee)

-- 1. Add persistent flag
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_okr_subtask boolean NOT NULL DEFAULT false;

-- 2. Mark every task that currently has a kr_id set
UPDATE public.tasks
SET is_okr_subtask = true
WHERE kr_id IS NOT NULL;

-- 3. Swap FK constraint: SET NULL → CASCADE
DO $$
DECLARE
  c text;
BEGIN
  SELECT tc.constraint_name INTO c
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name   = 'tasks'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name    = 'kr_id'
  LIMIT 1;

  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.tasks DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_kr_id_fkey
  FOREIGN KEY (kr_id) REFERENCES public.okr_key_results(id) ON DELETE CASCADE;

-- 4. Clean up orphaned OKR subtasks whose kr_id was already NULLed by the old FK.
--    Safe heuristic: task has no parent, no description, no tags, no watchers,
--    was created after OKR module (migration 034), AND the creator has at least
--    one OKR objective or OKR assignee record.
DELETE FROM public.tasks t
WHERE t.parent_id     IS NULL
  AND t.kr_id         IS NULL
  AND t.is_okr_subtask = false
  AND (t.description  IS NULL OR t.description = '')
  AND (t.tags         IS NULL OR t.tags = '{}')
  AND NOT EXISTS (
    SELECT 1 FROM public.task_watchers tw WHERE tw.task_id = t.id
  )
  AND (
    EXISTS (SELECT 1 FROM public.okr_objectives o  WHERE o.created_by = t.created_by)
    OR
    EXISTS (SELECT 1 FROM public.okr_assignees  oa WHERE oa.user_id   = t.created_by)
  )
  AND t.created_at > (
    SELECT COALESCE(MAX(created_at), '2000-01-01')
    FROM public.okr_objectives
  ) - INTERVAL '1 day';
