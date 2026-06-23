-- Migration 043: Alpro Pillar module (Phase 1)
-- Reusable OKR-like templates with Key Results, assigned to outlets/people
-- (by outlet, all outlets, area manager, department, role, or person). Each
-- assignee gets their own independent tracking instance.

-- Extend notification_type for Pillar events
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pillar_assigned';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pillar_commented';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pillar_mention';

-- ============================================================
-- TEMPLATES (created by HOD/Admin, reusable across assignments)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pillar_templates (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dept_id      uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  is_active    boolean NOT NULL DEFAULT true,
  created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pillar_kr_templates (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   uuid NOT NULL REFERENCES public.pillar_templates(id) ON DELETE CASCADE,
  title         text NOT NULL,
  description   text,
  metric_type   text NOT NULL DEFAULT 'percentage' CHECK (metric_type IN ('percentage','number','boolean','currency')),
  start_value   numeric NOT NULL DEFAULT 0,
  target_value  numeric NOT NULL DEFAULT 100,
  unit          text,
  position      integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ASSIGNMENTS (one independent instance per assignee per month)
-- Created either from a template, or as a free "adhoc" pillar.
-- A single "assign" action (e.g. assign template to all outlets for
-- Jul-Dec 2026) fans out into many rows sharing the same batch_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pillar_assignments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_id     uuid REFERENCES public.pillar_templates(id) ON DELETE SET NULL,
  batch_id        uuid NOT NULL DEFAULT uuid_generate_v4(),
  title           text NOT NULL,
  description     text,
  month           date NOT NULL, -- normalized to first day of month
  scope_type      text NOT NULL CHECK (scope_type IN ('outlet','all_outlets','area_manager','dept','role','person')),
  outlet_id       uuid REFERENCES public.outlets(id) ON DELETE CASCADE,
  assigned_to     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  dept_id         uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  area_manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','at_risk','completed','cancelled')),
  progress        numeric(5,2) NOT NULL DEFAULT 0,
  assigned_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (outlet_id IS NOT NULL OR assigned_to IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.pillar_assignment_krs (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id  uuid NOT NULL REFERENCES public.pillar_assignments(id) ON DELETE CASCADE,
  title          text NOT NULL,
  description    text,
  metric_type    text NOT NULL DEFAULT 'percentage' CHECK (metric_type IN ('percentage','number','boolean','currency')),
  start_value    numeric NOT NULL DEFAULT 0,
  target_value   numeric NOT NULL DEFAULT 100,
  current_value  numeric NOT NULL DEFAULT 0,
  unit           text,
  due_date       date,
  status         text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','on_track','at_risk','behind','completed')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pillar_subtasks (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id  uuid NOT NULL REFERENCES public.pillar_assignments(id) ON DELETE CASCADE,
  title          text NOT NULL,
  is_done        boolean NOT NULL DEFAULT false,
  position       integer NOT NULL DEFAULT 0,
  created_by     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pillar_comments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id     uuid NOT NULL REFERENCES public.pillar_assignments(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content           text NOT NULL,
  parent_comment_id uuid REFERENCES public.pillar_comments(id) ON DELETE CASCADE,
  attachments       jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS pillar_templates_org_id_idx ON public.pillar_templates(org_id);
CREATE INDEX IF NOT EXISTS pillar_kr_templates_template_id_idx ON public.pillar_kr_templates(template_id);

CREATE INDEX IF NOT EXISTS pillar_assignments_org_id_idx ON public.pillar_assignments(org_id);
CREATE INDEX IF NOT EXISTS pillar_assignments_template_id_idx ON public.pillar_assignments(template_id);
CREATE INDEX IF NOT EXISTS pillar_assignments_batch_id_idx ON public.pillar_assignments(batch_id);
CREATE INDEX IF NOT EXISTS pillar_assignments_outlet_id_idx ON public.pillar_assignments(outlet_id);
CREATE INDEX IF NOT EXISTS pillar_assignments_assigned_to_idx ON public.pillar_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS pillar_assignments_month_idx ON public.pillar_assignments(month);

CREATE INDEX IF NOT EXISTS pillar_assignment_krs_assignment_id_idx ON public.pillar_assignment_krs(assignment_id);
CREATE INDEX IF NOT EXISTS pillar_subtasks_assignment_id_idx ON public.pillar_subtasks(assignment_id);
CREATE INDEX IF NOT EXISTS pillar_comments_assignment_id_idx ON public.pillar_comments(assignment_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.pillar_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_kr_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_assignment_krs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pillar_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_pillar_templates" ON public.pillar_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_templates" ON public.pillar_templates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_kr_templates" ON public.pillar_kr_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_kr_templates" ON public.pillar_kr_templates FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_assignments" ON public.pillar_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_assignments" ON public.pillar_assignments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_assignment_krs" ON public.pillar_assignment_krs FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_assignment_krs" ON public.pillar_assignment_krs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_subtasks" ON public.pillar_subtasks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_subtasks" ON public.pillar_subtasks FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_pillar_comments" ON public.pillar_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_pillar_comments" ON public.pillar_comments FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_pillar_template_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_template_updated_at BEFORE UPDATE ON public.pillar_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_template_updated_at();

CREATE OR REPLACE FUNCTION public.update_pillar_assignment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_assignment_updated_at BEFORE UPDATE ON public.pillar_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_assignment_updated_at();

CREATE OR REPLACE FUNCTION public.update_pillar_kr_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_kr_updated_at BEFORE UPDATE ON public.pillar_assignment_krs
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_kr_updated_at();

CREATE OR REPLACE FUNCTION public.update_pillar_subtask_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_subtask_updated_at BEFORE UPDATE ON public.pillar_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_subtask_updated_at();

CREATE OR REPLACE FUNCTION public.update_pillar_comment_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pillar_comment_updated_at BEFORE UPDATE ON public.pillar_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_pillar_comment_updated_at();

-- ============================================================
-- AUTO-RECALCULATE ASSIGNMENT PROGRESS
-- Progress = average of KR progress and subtask completion ratio
-- (mirrors recalculate_okr_progress, extended to also weigh subtasks)
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_pillar_progress(p_assignment_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  kr_avg numeric;
  kr_count integer;
  subtask_total integer;
  subtask_done integer;
  subtask_pct numeric;
  final_progress numeric;
BEGIN
  SELECT
    COALESCE(AVG(
      CASE
        WHEN metric_type = 'boolean' THEN (CASE WHEN current_value >= 1 THEN 100 ELSE 0 END)
        WHEN (target_value - start_value) = 0 THEN 0
        ELSE LEAST(100, GREATEST(0, ((current_value - start_value) / (target_value - start_value)) * 100))
      END
    ), 0),
    COUNT(*)
  INTO kr_avg, kr_count
  FROM public.pillar_assignment_krs
  WHERE assignment_id = p_assignment_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_done)
  INTO subtask_total, subtask_done
  FROM public.pillar_subtasks
  WHERE assignment_id = p_assignment_id;

  subtask_pct := CASE WHEN subtask_total > 0 THEN (subtask_done::numeric / subtask_total) * 100 ELSE NULL END;

  final_progress := CASE
    WHEN kr_count > 0 AND subtask_pct IS NOT NULL THEN (kr_avg + subtask_pct) / 2
    WHEN kr_count > 0 THEN kr_avg
    WHEN subtask_pct IS NOT NULL THEN subtask_pct
    ELSE 0
  END;

  UPDATE public.pillar_assignments
  SET progress = final_progress,
      status = CASE WHEN final_progress >= 100 THEN 'completed' WHEN status = 'completed' THEN 'in_progress' ELSE status END,
      updated_at = now()
  WHERE id = p_assignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_pillar_progress_kr()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.recalculate_pillar_progress(COALESCE(NEW.assignment_id, OLD.assignment_id));
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_pillar_progress_recalc_kr
AFTER INSERT OR UPDATE OR DELETE ON public.pillar_assignment_krs
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_pillar_progress_kr();

CREATE OR REPLACE FUNCTION public.trg_recalc_pillar_progress_subtask()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.recalculate_pillar_progress(COALESCE(NEW.assignment_id, OLD.assignment_id));
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_pillar_progress_recalc_subtask
AFTER INSERT OR UPDATE OR DELETE ON public.pillar_subtasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_pillar_progress_subtask();
