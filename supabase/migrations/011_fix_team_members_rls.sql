-- ============================================================
-- Fix: team_members had RLS enabled but zero policies
-- Adds SELECT / INSERT / DELETE policies so members can
-- join, leave and view team memberships within their org
-- ============================================================

-- View: any org member can see memberships for teams in their org
create policy "team_members: org members can view"
  on team_members for select to authenticated
  using (
    team_id in (
      select id from teams where org_id = get_my_org_id()
    )
  );

-- Join: a user can add their own membership to an org team
create policy "team_members: members can join"
  on team_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and team_id in (
      select id from teams where org_id = get_my_org_id()
    )
  );

-- Leave / remove: a user can leave (delete own row);
-- team leaders and above can also remove anyone from their org's teams
create policy "team_members: members can leave, leaders can remove"
  on team_members for delete to authenticated
  using (
    user_id = auth.uid()
    or (
      is_team_leader_or_above()
      and team_id in (
        select id from teams where org_id = get_my_org_id()
      )
    )
  );

-- Update: team leaders can change member roles within their org
create policy "team_members: leaders can update roles"
  on team_members for update to authenticated
  using (
    is_team_leader_or_above()
    and team_id in (
      select id from teams where org_id = get_my_org_id()
    )
  )
  with check (
    is_team_leader_or_above()
    and team_id in (
      select id from teams where org_id = get_my_org_id()
    )
  );
