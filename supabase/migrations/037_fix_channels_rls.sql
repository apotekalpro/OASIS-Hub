-- Fix channels INSERT policy to allow any authenticated org member to create channels
-- Previous policy "channels: leaders can create" had is_team_leader_or_above() check
-- which may have been dropped/invalidated by migration 032's CASCADE drops.

DROP POLICY IF EXISTS "channels: leaders can create" ON public.channels;

CREATE POLICY "channels: members can create"
  ON public.channels FOR INSERT TO authenticated
  WITH CHECK (org_id = get_my_org_id());

-- Also ensure SELECT policy exists
DROP POLICY IF EXISTS "channels: members can view their channels" ON public.channels;

CREATE POLICY "channels: members can view their channels"
  ON public.channels FOR SELECT TO authenticated
  USING (org_id = get_my_org_id() AND (
    NOT is_private OR id IN (SELECT channel_id FROM channel_members WHERE user_id = auth.uid())
  ));

-- Allow channel creator to update/delete their channels
DROP POLICY IF EXISTS "channels: creator can update" ON public.channels;
CREATE POLICY "channels: creator can update"
  ON public.channels FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_dept_head_or_above());

DROP POLICY IF EXISTS "channels: creator can delete" ON public.channels;
CREATE POLICY "channels: creator can delete"
  ON public.channels FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_dept_head_or_above());
