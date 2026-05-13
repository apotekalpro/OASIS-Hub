-- ============================================================
-- OASIS Hub - Phase 2: Teams, Channels, Directory
-- ============================================================

-- Auto-create a #general channel when a team is created
create or replace function create_team_general_channel()
returns trigger as $$
begin
  insert into channels (org_id, team_id, name, description, is_private, created_by)
  values (new.org_id, new.id, 'general', 'General team channel', false, new.created_by);
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_team_general_channel
  after insert on teams
  for each row execute function create_team_general_channel();

-- Auto-add team creator as team_leader in team_members
create or replace function add_team_creator_as_leader()
returns trigger as $$
begin
  if new.created_by is not null then
    insert into team_members (team_id, user_id, role)
    values (new.id, new.created_by, 'team_leader')
    on conflict (team_id, user_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_team_creator_leader
  after insert on teams
  for each row execute function add_team_creator_as_leader();

-- Auto-add team members to the team's #general channel
create or replace function sync_team_member_to_channel()
returns trigger as $$
declare
  v_channel_id uuid;
begin
  select id into v_channel_id
  from channels
  where team_id = new.team_id and name = 'general'
  limit 1;

  if v_channel_id is not null then
    insert into channel_members (channel_id, user_id)
    values (v_channel_id, new.user_id)
    on conflict (channel_id, user_id) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_sync_team_member_channel
  after insert on team_members
  for each row execute function sync_team_member_to_channel();

-- Update team member count view (optional helper)
create or replace view team_member_counts as
  select team_id, count(*) as member_count
  from team_members
  group by team_id;

-- Enable Realtime on key tables (run in Supabase dashboard as well)
-- These comments serve as a reminder:
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
-- ALTER PUBLICATION supabase_realtime ADD TABLE task_comments;
