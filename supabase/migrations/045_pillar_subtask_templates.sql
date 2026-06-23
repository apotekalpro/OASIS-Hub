-- Migration 045: Subtask templates for Alpro Pillar
-- Allows defining subtasks directly on a Pillar template; these are seeded as
-- pillar_subtasks rows on every assignment created from the template (mirrors
-- how pillar_kr_templates seeds pillar_assignment_krs).

CREATE TABLE IF NOT EXISTS public.pillar_subtask_templates (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id  uuid NOT NULL REFERENCES public.pillar_templates(id) ON DELETE CASCADE,
  title        text NOT NULL,
  position     integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pillar_subtask_templates_template_id_idx ON public.pillar_subtask_templates(template_id);

ALTER TABLE public.pillar_subtask_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_pillar_subtask_templates" ON public.pillar_subtask_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_subtask_templates" ON public.pillar_subtask_templates FOR ALL USING (auth.uid() IS NOT NULL);
