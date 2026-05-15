-- Migration 030: Fix infinite recursion in teams ↔ team_members RLS policies
--
-- Root cause:
--   teams SELECT policy   → queries team_members (to check private visibility)
--   team_members policies → query teams (to verify org membership)
--   → circular dependency → "infinite recursion detected in policy for relation teams"
--
-- Fix: two SECURITY DEFINER helper functions that each run with postgres-role
-- privileges (bypassing RLS), breaking the cycle.

-- ── Helper 1: return the current user's team_ids without triggering RLS ──────
CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid()
$$;

-- ── Helper 2: check a team belongs to the current user's org without RLS ─────
CREATE OR REPLACE FUNCTION team_in_my_org(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM teams WHERE id = p_team_id AND org_id = get_my_org_id()
  )
$$;

-- ── teams: replace SELECT policy ─────────────────────────────────────────────
DROP POLICY IF EXISTS "teams: org members can view non-private teams" ON teams;

CREATE POLICY "teams: org members can view non-private teams"
  ON teams FOR SELECT TO authenticated
  USING (
    org_id = get_my_org_id()
    AND (NOT is_private OR id IN (SELECT get_my_team_ids()))
  );

-- ── team_members: replace all policies using team_in_my_org() ────────────────
DROP POLICY IF EXISTS "team_members: org members can view" ON team_members;
CREATE POLICY "team_members: org members can view"
  ON team_members FOR SELECT TO authenticated
  USING (team_in_my_org(team_id));

DROP POLICY IF EXISTS "team_members: members can join" ON team_members;
CREATE POLICY "team_members: members can join"
  ON team_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND team_in_my_org(team_id));

DROP POLICY IF EXISTS "team_members: members can leave, leaders can remove" ON team_members;
CREATE POLICY "team_members: members can leave, leaders can remove"
  ON team_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR (is_team_leader_or_above() AND team_in_my_org(team_id))
  );

DROP POLICY IF EXISTS "team_members: leaders can update roles" ON team_members;
CREATE POLICY "team_members: leaders can update roles"
  ON team_members FOR UPDATE TO authenticated
  USING (is_team_leader_or_above() AND team_in_my_org(team_id))
  WITH CHECK (is_team_leader_or_above() AND team_in_my_org(team_id));
