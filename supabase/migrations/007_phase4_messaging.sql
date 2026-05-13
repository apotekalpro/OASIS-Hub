-- ============================================================
-- OASIS Hub - Phase 4: Messaging Functions
-- ============================================================

-- Mark channel as read for a user
create or replace function mark_channel_read(p_channel_id uuid)
returns void as $$
begin
  insert into channel_members (channel_id, user_id, last_read_at)
  values (p_channel_id, auth.uid(), now())
  on conflict (channel_id, user_id)
  do update set last_read_at = now();
end;
$$ language plpgsql security definer;

-- Get unread message counts per channel for current user
create or replace function get_unread_counts()
returns table(channel_id uuid, unread_count bigint) as $$
begin
  return query
  select
    cm.channel_id,
    count(m.id) as unread_count
  from channel_members cm
  join messages m on m.channel_id = cm.channel_id
  where cm.user_id = auth.uid()
    and m.created_at > cm.last_read_at
    and m.user_id != auth.uid()
  group by cm.channel_id;
end;
$$ language plpgsql security definer;

-- Create or get direct message channel between two users
create or replace function get_or_create_dm(p_other_user_id uuid)
returns uuid as $$
declare
  v_channel_id uuid;
  v_org_id uuid;
begin
  select org_id into v_org_id from profiles where id = auth.uid();

  -- Look for existing DM channel between these two users
  select c.id into v_channel_id
  from channels c
  join channel_members cm1 on cm1.channel_id = c.id and cm1.user_id = auth.uid()
  join channel_members cm2 on cm2.channel_id = c.id and cm2.user_id = p_other_user_id
  where c.is_direct = true
    and c.org_id = v_org_id
    and (select count(*) from channel_members where channel_id = c.id) = 2
  limit 1;

  if v_channel_id is not null then
    return v_channel_id;
  end if;

  -- Create new DM channel
  insert into channels (org_id, name, is_direct, is_private, created_by)
  values (v_org_id, 'dm', true, true, auth.uid())
  returning id into v_channel_id;

  -- Add both members
  insert into channel_members (channel_id, user_id) values
    (v_channel_id, auth.uid()),
    (v_channel_id, p_other_user_id);

  return v_channel_id;
end;
$$ language plpgsql security definer;

-- Notify on message mention
create or replace function notify_message_mention()
returns trigger as $$
declare
  v_sender_name text;
  v_channel_name text;
  v_mentioned_id uuid;
begin
  if array_length(new.mentions, 1) is null then
    return new;
  end if;

  select full_name into v_sender_name from profiles where id = new.user_id;
  select name into v_channel_name from channels where id = new.channel_id;

  foreach v_mentioned_id in array new.mentions loop
    if v_mentioned_id != new.user_id then
      perform create_notification(
        v_mentioned_id,
        'mention',
        coalesce(v_sender_name, 'Someone') || ' mentioned you in #' || coalesce(v_channel_name, 'a channel'),
        left(new.content, 200),
        jsonb_build_object('channel_id', new.channel_id, 'message_id', new.id)
      );
    end if;
  end loop;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_message_mention on messages;
create trigger trg_notify_message_mention
  after insert on messages
  for each row execute function notify_message_mention();

-- Allow channel members policy for direct messages
do $$ begin
  create policy "channel_members: users can join DM channels"
    on channel_members for insert to authenticated
    with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "channel_members: users can view memberships in their channels"
    on channel_members for select to authenticated
    using (
      channel_id in (select channel_id from channel_members where user_id = auth.uid())
      or user_id = auth.uid()
    );
exception when duplicate_object then null; end $$;

-- Messages: allow delete own messages
do $$ begin
  create policy "messages: owners can delete"
    on messages for delete to authenticated
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
