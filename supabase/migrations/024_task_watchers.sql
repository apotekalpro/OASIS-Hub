-- CC / watchers for tasks
CREATE TABLE IF NOT EXISTS public.task_watchers (
  task_id    uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.task_watchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_view_watchers" ON public.task_watchers;
CREATE POLICY "org_members_view_watchers"
  ON public.task_watchers FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "org_members_manage_watchers" ON public.task_watchers;
CREATE POLICY "org_members_manage_watchers"
  ON public.task_watchers FOR ALL
  USING (auth.uid() IS NOT NULL);
