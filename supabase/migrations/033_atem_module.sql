-- Migration 033: ATEM (Action Tracking & Execution Matrix) module

CREATE TABLE IF NOT EXISTS public.atem_items (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id               uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dept_id              uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  team_id              uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  -- TDIDSCE fields
  task                 text NOT NULL,
  deadline             timestamptz,
  impact               text,
  dependencies         text,
  strategic_alignment  text,
  consequences_of_delay text,
  estimated_time       numeric(6,2),    -- hours
  -- Meta
  status               text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','blocked')),
  priority             text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  tags                 text[] DEFAULT '{}',
  created_by           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atem_assignees (
  atem_id      uuid NOT NULL REFERENCES public.atem_items(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  assigned_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (atem_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.atem_watchers (
  atem_id   uuid NOT NULL REFERENCES public.atem_items(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atem_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.atem_comments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  atem_id           uuid NOT NULL REFERENCES public.atem_items(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content           text NOT NULL,
  parent_comment_id uuid REFERENCES public.atem_comments(id) ON DELETE CASCADE,
  attachments       jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.atem_comment_reactions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id  uuid NOT NULL REFERENCES public.atem_comments(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, emoji)
);

-- Indexes
CREATE INDEX IF NOT EXISTS atem_items_org_id_idx ON public.atem_items(org_id);
CREATE INDEX IF NOT EXISTS atem_items_created_by_idx ON public.atem_items(created_by);
CREATE INDEX IF NOT EXISTS atem_comments_atem_id_idx ON public.atem_comments(atem_id);

-- RLS
ALTER TABLE public.atem_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atem_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atem_watchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atem_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atem_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_view_atem" ON public.atem_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_atem" ON public.atem_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_atem_assignees" ON public.atem_assignees FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_atem_assignees" ON public.atem_assignees FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_atem_watchers" ON public.atem_watchers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_atem_watchers" ON public.atem_watchers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_atem_comments" ON public.atem_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_atem_comments" ON public.atem_comments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_view_atem_reactions" ON public.atem_comment_reactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "org_members_manage_atem_reactions" ON public.atem_comment_reactions FOR ALL USING (auth.uid() IS NOT NULL);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_atem_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_atem_updated_at BEFORE UPDATE ON public.atem_items
  FOR EACH ROW EXECUTE FUNCTION public.update_atem_updated_at();
