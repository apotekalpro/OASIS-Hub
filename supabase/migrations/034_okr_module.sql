-- Migration 034: OKR (Objectives & Key Results) module

CREATE TABLE IF NOT EXISTS public.okr_objectives (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id       uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dept_id      uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id      uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  title        text NOT NULL,
  description  text,
  period_type  text NOT NULL DEFAULT 'quarterly' CHECK (period_type IN ('monthly','quarterly','annual')),
  period_label text,
  start_date   date,
  end_date     date,
  status       text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track','at_risk','behind','completed','cancelled')),
  progress     numeric(5,2) NOT NULL DEFAULT 0,
  created_by   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.okr_key_results (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id   uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.okr_assignees (
  objective_id  uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'contributor' CHECK (role IN ('owner','contributor')),
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.okr_watchers (
  objective_id  uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (objective_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.okr_comments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  objective_id      uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content           text NOT NULL,
  parent_comment_id uuid REFERENCES public.okr_comments(id) ON DELETE CASCADE,
  attachments       jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.okr_comment_reactions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id  uuid NOT NULL REFERENCES public.okr_comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS okr_objectives_org_id_idx ON public.okr_objectives(org_id);
CREATE INDEX IF NOT EXISTS okr_key_results_objective_id_idx ON public.okr_key_results(objective_id);
CREATE INDEX IF NOT EXISTS okr_comments_objective_id_idx ON public.okr_comments(objective_id);
CREATE INDEX IF NOT EXISTS okr_assignees_objective_id_idx ON public.okr_assignees(objective_id);
CREATE INDEX IF NOT EXISTS okr_watchers_objective_id_idx ON public.okr_watchers(objective_id);

-- RLS
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.okr_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_okr_obj" ON public.okr_objectives FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_okr_obj" ON public.okr_objectives FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_okr_kr" ON public.okr_key_results FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_okr_kr" ON public.okr_key_results FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_okr_assignees" ON public.okr_assignees FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_okr_assignees" ON public.okr_assignees FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_okr_watchers" ON public.okr_watchers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_okr_watchers" ON public.okr_watchers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_okr_comments" ON public.okr_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_okr_comments" ON public.okr_comments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_okr_reactions" ON public.okr_comment_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_okr_reactions" ON public.okr_comment_reactions FOR ALL USING (auth.uid() IS NOT NULL);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_okr_obj_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_okr_obj_updated_at BEFORE UPDATE ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_okr_obj_updated_at();

CREATE OR REPLACE FUNCTION public.update_okr_kr_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_okr_kr_updated_at BEFORE UPDATE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.update_okr_kr_updated_at();

-- Auto-recalculate objective progress when KR updated
CREATE OR REPLACE FUNCTION public.recalculate_okr_progress()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  obj_id uuid;
  avg_prog numeric;
BEGIN
  obj_id := COALESCE(NEW.objective_id, OLD.objective_id);
  SELECT COALESCE(AVG(
    CASE
      WHEN metric_type = 'boolean' THEN (CASE WHEN current_value >= 1 THEN 100 ELSE 0 END)
      WHEN (target_value - start_value) = 0 THEN 0
      ELSE LEAST(100, GREATEST(0, ((current_value - start_value) / (target_value - start_value)) * 100))
    END
  ), 0)
  INTO avg_prog
  FROM public.okr_key_results
  WHERE objective_id = obj_id;

  UPDATE public.okr_objectives SET progress = avg_prog, updated_at = now() WHERE id = obj_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_okr_progress_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.okr_key_results
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_okr_progress();
