-- ============================================================
-- OASIS Hub - Phase 7: Calendar & Files
-- ============================================================

-- RLS for events
do $$ begin
  create policy "events: org members can view"
    on events for select to authenticated
    using (org_id = get_my_org_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "events: authenticated can create"
    on events for insert to authenticated
    with check (org_id = get_my_org_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "events: creator can update/delete"
    on events for update to authenticated
    using (created_by = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "events: creator can delete"
    on events for delete to authenticated
    using (created_by = auth.uid());
exception when duplicate_object then null; end $$;

-- RLS for event_attendees
do $$ begin
  create policy "event_attendees: org members can view"
    on event_attendees for select to authenticated
    using (event_id in (select id from events where org_id = get_my_org_id()));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "event_attendees: members can rsvp"
    on event_attendees for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- RLS for files
do $$ begin
  create policy "files: org members can view"
    on files for select to authenticated
    using (org_id = get_my_org_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "files: org members can upload"
    on files for insert to authenticated
    with check (org_id = get_my_org_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "files: uploader can update/delete"
    on files for update to authenticated
    using (uploaded_by = auth.uid() or is_dept_head_or_above());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "files: uploader or manager can delete"
    on files for delete to authenticated
    using (uploaded_by = auth.uid() or is_dept_head_or_above());
exception when duplicate_object then null; end $$;

-- Notify attendees when added to an event
create or replace function notify_event_invite()
returns trigger as $$
declare
  v_event events%rowtype;
  v_creator_name text;
begin
  select * into v_event from events where id = new.event_id;
  select full_name into v_creator_name from profiles where id = v_event.created_by;

  if new.user_id != v_event.created_by then
    perform create_notification(
      new.user_id,
      'event_invite',
      'You''re invited: ' || v_event.title,
      coalesce(v_creator_name, 'Someone') || ' · ' ||
        to_char(v_event.start_at at time zone 'UTC', 'Mon DD, HH12:MI AM'),
      jsonb_build_object('event_id', new.event_id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_event_invite on event_attendees;
create trigger trg_notify_event_invite
  after insert on event_attendees
  for each row execute function notify_event_invite();

-- Updated_at trigger for events
drop trigger if exists trg_events_updated_at on events;
create trigger trg_events_updated_at
  before update on events
  for each row execute function update_updated_at();
