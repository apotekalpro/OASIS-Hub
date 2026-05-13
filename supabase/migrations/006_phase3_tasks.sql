-- ============================================================
-- OASIS Hub - Phase 3: Task Management Functions
-- ============================================================

-- Notify task creator when a comment is added
create or replace function notify_task_comment()
returns trigger as $$
declare
  v_task tasks%rowtype;
  v_commenter_name text;
begin
  select * into v_task from tasks where id = new.task_id;
  select full_name into v_commenter_name from profiles where id = new.user_id;

  -- Notify task creator (if not the commenter)
  if v_task.created_by != new.user_id then
    perform create_notification(
      v_task.created_by,
      'task_commented',
      coalesce(v_commenter_name, 'Someone') || ' commented on: ' || v_task.title,
      left(new.content, 200),
      jsonb_build_object('task_id', new.task_id, 'comment_id', new.id)
    );
  end if;

  -- Notify all assignees (except the commenter)
  insert into notifications (user_id, type, title, body, data)
  select
    ta.user_id,
    'task_commented',
    coalesce(v_commenter_name, 'Someone') || ' commented on: ' || v_task.title,
    left(new.content, 200),
    jsonb_build_object('task_id', new.task_id, 'comment_id', new.id)
  from task_assignees ta
  where ta.task_id = new.task_id
    and ta.user_id != new.user_id
    and ta.user_id != v_task.created_by;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_task_comment on task_comments;
create trigger trg_notify_task_comment
  after insert on task_comments
  for each row execute function notify_task_comment();

-- Notify on task completion
create or replace function notify_task_completed()
returns trigger as $$
declare
  v_updater_name text;
begin
  if new.status = 'done' and old.status != 'done' then
    select full_name into v_updater_name from profiles where id = auth.uid();

    -- Notify creator
    if old.created_by != auth.uid() then
      perform create_notification(
        old.created_by,
        'task_completed',
        'Task completed: ' || new.title,
        'Marked done by ' || coalesce(v_updater_name, 'someone'),
        jsonb_build_object('task_id', new.id)
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_task_completed on tasks;
create trigger trg_notify_task_completed
  after update on tasks
  for each row execute function notify_task_completed();

-- Helper: get task with full details (used in API)
create or replace function get_task_details(p_task_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'task', row_to_json(t),
    'assignees', (
      select jsonb_agg(jsonb_build_object(
        'user_id', ta.user_id,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url,
        'email', p.email
      ))
      from task_assignees ta
      join profiles p on p.id = ta.user_id
      where ta.task_id = p_task_id
    ),
    'comments', (
      select jsonb_agg(jsonb_build_object(
        'id', tc.id,
        'content', tc.content,
        'created_at', tc.created_at,
        'user', jsonb_build_object(
          'id', p.id,
          'full_name', p.full_name,
          'avatar_url', p.avatar_url
        )
      ) order by tc.created_at)
      from task_comments tc
      join profiles p on p.id = tc.user_id
      where tc.task_id = p_task_id
    ),
    'subtasks', (
      select jsonb_agg(row_to_json(sub))
      from tasks sub
      where sub.parent_id = p_task_id
    ),
    'time_logs', (
      select jsonb_agg(jsonb_build_object(
        'id', tl.id,
        'hours', tl.hours,
        'description', tl.description,
        'logged_at', tl.logged_at,
        'user', jsonb_build_object('full_name', p.full_name)
      ) order by tl.logged_at desc)
      from task_time_logs tl
      join profiles p on p.id = tl.user_id
      where tl.task_id = p_task_id
    )
  ) into v_result
  from tasks t
  where t.id = p_task_id;

  return v_result;
end;
$$ language plpgsql security definer;
