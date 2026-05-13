-- ============================================================
-- OASIS Hub - Initial Schema
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";

-- ============================================================
-- ENUMS
-- ============================================================

create type user_role as enum (
  'super_admin',
  'org_admin',
  'dept_head',
  'team_leader',
  'member',
  'auditor',
  'viewer'
);

create type task_status as enum (
  'todo',
  'in_progress',
  'in_review',
  'done',
  'cancelled'
);

create type task_priority as enum ('low', 'medium', 'high', 'urgent');

create type notification_type as enum (
  'task_assigned',
  'task_due_soon',
  'task_overdue',
  'task_completed',
  'task_commented',
  'form_assigned',
  'form_due_soon',
  'form_submitted',
  'form_reviewed',
  'message_mention',
  'event_reminder',
  'system',
  'user_invited',
  'password_reset'
);

create type form_status as enum (
  'draft',
  'submitted',
  'in_review',
  'approved',
  'rejected'
);

create type reminder_frequency as enum (
  'once',
  'daily',
  'weekly',
  'monthly'
);

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  logo_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

create table departments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  parent_id uuid references departments(id) on delete set null,
  name text not null,
  description text,
  color text default '#6366f1',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id) on delete cascade,
  dept_id uuid references departments(id) on delete set null,
  employee_id text,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  job_title text,
  role user_role not null default 'member',
  is_active boolean default true,
  must_change_password boolean default true,
  timezone text default 'Asia/Kuala_Lumpur',
  notification_preferences jsonb default '{
    "email_task_assigned": true,
    "email_task_due": true,
    "email_mentions": true,
    "email_digest": "daily",
    "push_task_assigned": true,
    "push_task_due": true,
    "push_mentions": true
  }'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- TEAMS
-- ============================================================

create table teams (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_id uuid references departments(id) on delete set null,
  name text not null,
  description text,
  avatar_url text,
  color text default '#8b5cf6',
  is_private boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table team_members (
  team_id uuid references teams(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role user_role default 'member',
  joined_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- ============================================================
-- TASKS
-- ============================================================

create table tasks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_id uuid references departments(id),
  team_id uuid references teams(id),
  parent_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text,
  status task_status default 'todo',
  priority task_priority default 'medium',
  due_date timestamptz,
  start_date timestamptz,
  estimated_hours numeric(6,2),
  actual_hours numeric(6,2),
  tags text[] default '{}',
  attachments jsonb default '[]'::jsonb,
  created_by uuid not null references profiles(id),
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table task_assignees (
  task_id uuid references tasks(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  assigned_at timestamptz default now(),
  assigned_by uuid references profiles(id),
  primary key (task_id, user_id)
);

create table task_comments (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id),
  content text not null,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table task_time_logs (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id),
  hours numeric(6,2) not null,
  description text,
  logged_at date default current_date,
  created_at timestamptz default now()
);

-- ============================================================
-- CHANNELS & MESSAGES
-- ============================================================

create table channels (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_id uuid references departments(id),
  team_id uuid references teams(id),
  name text not null,
  description text,
  is_private boolean default false,
  is_direct boolean default false,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table channel_members (
  channel_id uuid references channels(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  last_read_at timestamptz default now(),
  joined_at timestamptz default now(),
  primary key (channel_id, user_id)
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references channels(id) on delete cascade,
  user_id uuid not null references profiles(id),
  parent_id uuid references messages(id) on delete cascade,
  content text not null,
  attachments jsonb default '[]'::jsonb,
  mentions uuid[] default '{}',
  reactions jsonb default '{}'::jsonb,
  is_pinned boolean default false,
  edited_at timestamptz,
  created_at timestamptz default now()
);

-- ============================================================
-- INSPECTION FORMS
-- ============================================================

create table form_templates (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_id uuid references departments(id),
  title text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  passing_score numeric(5,2),
  version integer default 1,
  is_active boolean default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table form_assignments (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid not null references form_templates(id) on delete cascade,
  assigned_to uuid references profiles(id),
  assigned_team uuid references teams(id),
  due_date timestamptz,
  is_recurring boolean default false,
  recurrence_rule text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table form_submissions (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid not null references form_templates(id),
  assignment_id uuid references form_assignments(id),
  submitted_by uuid not null references profiles(id),
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  status form_status default 'draft',
  reviewer_id uuid references profiles(id),
  reviewer_notes text,
  reviewed_at timestamptz,
  location jsonb,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

create table events (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_id uuid references departments(id),
  team_id uuid references teams(id),
  title text not null,
  description text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_all_day boolean default false,
  is_recurring boolean default false,
  recurrence_rule text,
  created_by uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table event_attendees (
  event_id uuid references events(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  rsvp text check (rsvp in ('accepted','declined','tentative','pending')) default 'pending',
  primary key (event_id, user_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  type notification_type not null,
  title text not null,
  body text,
  data jsonb default '{}'::jsonb,
  is_read boolean default false,
  email_sent boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- REMINDERS
-- ============================================================

create table reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  ref_type text not null check (ref_type in ('task','form','event','custom')),
  ref_id uuid,
  title text not null,
  body text,
  remind_at timestamptz not null,
  frequency reminder_frequency default 'once',
  recurrence_end timestamptz,
  is_sent boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- FILES
-- ============================================================

create table files (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  dept_id uuid references departments(id),
  team_id uuid references teams(id),
  parent_folder_id uuid references files(id) on delete cascade,
  name text not null,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  is_folder boolean default false,
  uploaded_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references organizations(id),
  user_id uuid references profiles(id),
  action text not null,
  resource_type text,
  resource_id uuid,
  details jsonb default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_profiles_org_id on profiles(org_id);
create index idx_profiles_dept_id on profiles(dept_id);
create index idx_profiles_role on profiles(role);
create index idx_tasks_org_id on tasks(org_id);
create index idx_tasks_status on tasks(status);
create index idx_tasks_due_date on tasks(due_date);
create index idx_messages_channel_id on messages(channel_id);
create index idx_messages_created_at on messages(created_at desc);
create index idx_notifications_user_id on notifications(user_id);
create index idx_notifications_is_read on notifications(is_read);
create index idx_reminders_remind_at on reminders(remind_at) where is_sent = false and is_active = true;
create index idx_audit_logs_org_id on audit_logs(org_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_organizations_updated_at before update on organizations for each row execute function update_updated_at();
create trigger trg_departments_updated_at before update on departments for each row execute function update_updated_at();
create trigger trg_profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger trg_teams_updated_at before update on teams for each row execute function update_updated_at();
create trigger trg_tasks_updated_at before update on tasks for each row execute function update_updated_at();
create trigger trg_form_templates_updated_at before update on form_templates for each row execute function update_updated_at();
create trigger trg_form_submissions_updated_at before update on form_submissions for each row execute function update_updated_at();
create trigger trg_events_updated_at before update on events for each row execute function update_updated_at();
create trigger trg_files_updated_at before update on files for each row execute function update_updated_at();
