-- Chief multi-department assignments
CREATE TABLE IF NOT EXISTS public.chief_departments (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dept_id    uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dept_id)
);

ALTER TABLE public.chief_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_admin_manage_chief_departments" ON public.chief_departments;
CREATE POLICY "org_admin_manage_chief_departments"
  ON public.chief_departments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'org_admin')
    )
  );

DROP POLICY IF EXISTS "view_chief_departments"ON public.chief_departments;
CREATE POLICY "view_chief_departments"
  ON public.chief_departments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);
