-- ============================================================
-- OASIS Hub - Functions, Triggers & Stored Procedures
-- ============================================================

-- ============================================================
-- AUTO-CREATE PROFILE ON NEW USER
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email, full_name, role, must_change_password)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'member'),
    coalesce((new.raw_user_meta_data->>'must_change_password')::boolean, true)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- NOTIFICATION CREATION HELPER
-- ============================================================

create or replace function create_notification(
  p_user_id uuid,
  p_type notification_type,
  p_title text,
  p_body text default null,
  p_data jsonb default '{}'::jsonb
)
returns uuid as $$
declare
  v_id uuid;
begin
  insert into notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, p_data)
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer;

-- ============================================================
-- TASK ASSIGNMENT NOTIFICATION
-- ============================================================

create or replace function notify_task_assigned()
returns trigger as $$
declare
  v_task tasks%rowtype;
  v_assigner_name text;
begin
  select * into v_task from tasks where id = new.task_id;
  select full_name into v_assigner_name from profiles where id = new.assigned_by;

  perform create_notification(
    new.user_id,
    'task_assigned',
    'New task assigned: ' || v_task.title,
    'Assigned by ' || coalesce(v_assigner_name, 'someone'),
    jsonb_build_object('task_id', new.task_id, 'assigned_by', new.assigned_by)
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_task_assigned
  after insert on task_assignees
  for each row execute function notify_task_assigned();

-- ============================================================
-- MESSAGE MENTION NOTIFICATION
-- ============================================================

create or replace function notify_message_mention()
returns trigger as $$
declare
  v_mentioned_user uuid;
  v_sender_name text;
  v_channel_name text;
begin
  select full_name into v_sender_name from profiles where id = new.user_id;
  select name into v_channel_name from channels where id = new.channel_id;

  foreach v_mentioned_user in array new.mentions loop
    if v_mentioned_user != new.user_id then
      perform create_notification(
        v_mentioned_user,
        'message_mention',
        coalesce(v_sender_name, 'Someone') || ' mentioned you in #' || coalesce(v_channel_name, 'a channel'),
        left(new.content, 200),
        jsonb_build_object('message_id', new.id, 'channel_id', new.channel_id)
      );
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_message_mention
  after insert on messages
  for each row when (array_length(new.mentions, 1) > 0)
  execute function notify_message_mention();

-- ============================================================
-- FORM SUBMISSION NOTIFICATION
-- ============================================================

create or replace function notify_form_submitted()
returns trigger as $$
declare
  v_form form_templates%rowtype;
  v_submitter_name text;
  v_reviewer uuid;
begin
  if new.status = 'submitted' and (old.status is null or old.status = 'draft') then
    select * into v_form from form_templates where id = new.form_id;
    select full_name into v_submitter_name from profiles where id = new.submitted_by;

    -- Notify dept heads in the form's department
    for v_reviewer in (
      select id from profiles
      where dept_id = v_form.dept_id and role in ('dept_head', 'org_admin', 'super_admin')
      limit 5
    ) loop
      perform create_notification(
        v_reviewer,
        'form_submitted',
        'Form submitted: ' || v_form.title,
        coalesce(v_submitter_name, 'Someone') || ' submitted a form for review',
        jsonb_build_object('form_id', new.form_id, 'submission_id', new.id)
      );
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_form_submitted
  after insert or update on form_submissions
  for each row execute function notify_form_submitted();

-- ============================================================
-- OVERDUE TASK REMINDERS (called by cron)
-- ============================================================

create or replace function send_overdue_task_notifications()
returns void as $$
declare
  v_task tasks%rowtype;
  v_assignee task_assignees%rowtype;
begin
  for v_task in (
    select t.* from tasks t
    where t.status not in ('done','cancelled')
      and t.due_date < now()
      and t.due_date > now() - interval '24 hours'
  ) loop
    for v_assignee in (
      select * from task_assignees where task_id = v_task.id
    ) loop
      perform create_notification(
        v_assignee.user_id,
        'task_overdue',
        'Task overdue: ' || v_task.title,
        'This task was due ' || to_char(v_task.due_date, 'Mon DD, YYYY HH24:MI'),
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date)
      );
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- DUE SOON TASK REMINDERS (called by cron, 24h before)
-- ============================================================

create or replace function send_due_soon_notifications()
returns void as $$
declare
  v_task tasks%rowtype;
  v_assignee task_assignees%rowtype;
begin
  for v_task in (
    select t.* from tasks t
    where t.status not in ('done','cancelled')
      and t.due_date between now() + interval '23 hours' and now() + interval '25 hours'
  ) loop
    for v_assignee in (
      select * from task_assignees where task_id = v_task.id
    ) loop
      perform create_notification(
        v_assignee.user_id,
        'task_due_soon',
        'Task due soon: ' || v_task.title,
        'Due in approximately 24 hours',
        jsonb_build_object('task_id', v_task.id, 'due_date', v_task.due_date)
      );
    end loop;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- PROCESS REMINDERS (called by cron every 5 minutes)
-- ============================================================

create or replace function process_due_reminders()
returns void as $$
declare
  v_reminder reminders%rowtype;
begin
  for v_reminder in (
    select * from reminders
    where is_active = true
      and is_sent = false
      and remind_at <= now()
  ) loop
    perform create_notification(
      v_reminder.user_id,
      'system',
      v_reminder.title,
      v_reminder.body,
      jsonb_build_object('reminder_id', v_reminder.id, 'ref_type', v_reminder.ref_type, 'ref_id', v_reminder.ref_id)
    );

    if v_reminder.frequency = 'once' then
      update reminders set is_sent = true where id = v_reminder.id;
    elsif v_reminder.frequency = 'daily' then
      update reminders set remind_at = remind_at + interval '1 day' where id = v_reminder.id;
    elsif v_reminder.frequency = 'weekly' then
      update reminders set remind_at = remind_at + interval '1 week' where id = v_reminder.id;
    elsif v_reminder.frequency = 'monthly' then
      update reminders set remind_at = remind_at + interval '1 month' where id = v_reminder.id;
    end if;

    if v_reminder.recurrence_end is not null and v_reminder.remind_at > v_reminder.recurrence_end then
      update reminders set is_active = false where id = v_reminder.id;
    end if;
  end loop;
end;
$$ language plpgsql security definer;

-- ============================================================
-- AUDIT LOG HELPER
-- ============================================================

create or replace function log_audit(
  p_action text,
  p_resource_type text,
  p_resource_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void as $$
begin
  insert into audit_logs (org_id, user_id, action, resource_type, resource_id, details)
  values (get_my_org_id(), auth.uid(), p_action, p_resource_type, p_resource_id, p_details);
end;
$$ language plpgsql security definer;
