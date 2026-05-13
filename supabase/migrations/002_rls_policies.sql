-- ============================================================
-- OASIS Hub - Row Level Security Policies
-- ============================================================

alter table organizations enable row level security;
alter table departments enable row level security;
alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table tasks enable row level security;
alter table task_assignees enable row level security;
alter table task_comments enable row level security;
alter table task_time_logs enable row level security;
alter table channels enable row level security;
alter table channel_members enable row level security;
alter table messages enable row level security;
alter table form_templates enable row level security;
alter table form_assignments enable row level security;
alter table form_submissions enable row level security;
alter table events enable row level security;
alter table event_attendees enable row level security;
alter table notifications enable row level security;
alter table reminders enable row level security;
alter table files enable row level security;
alter table audit_logs enable row level security;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function get_my_org_id()
returns uuid as $$
  select org_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function get_my_role()
returns user_role as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_super_admin()
returns boolean as $$
  select role = 'super_admin' from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_org_admin_or_above()
returns boolean as $$
  select role in ('super_admin','org_admin') from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_dept_head_or_above()
returns boolean as $$
  select role in ('super_admin','org_admin','dept_head') from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function is_team_leader_or_above()
returns boolean as $$
  select role in ('super_admin','org_admin','dept_head','team_leader') from profiles where id = auth.uid();
$$ language sql security definer stable;

-- ============================================================
-- ORGANIZATIONS
-- ============================================================

create policy "org: super admin can do anything"
  on organizations for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "org: members can view their org"
  on organizations for select to authenticated
  using (id = get_my_org_id());

-- ============================================================
-- DEPARTMENTS
-- ============================================================

create policy "dept: org members can view"
  on departments for select to authenticated
  using (org_id = get_my_org_id());

create policy "dept: admins can manage"
  on departments for all to authenticated
  using (org_id = get_my_org_id() and is_org_admin_or_above())
  with check (org_id = get_my_org_id() and is_org_admin_or_above());

-- ============================================================
-- PROFILES
-- ============================================================

create policy "profile: can view own profile"
  on profiles for select to authenticated
  using (id = auth.uid());

create policy "profile: org members can view each other"
  on profiles for select to authenticated
  using (org_id = get_my_org_id());

create policy "profile: can update own profile"
  on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

create policy "profile: admins can manage all in org"
  on profiles for all to authenticated
  using (org_id = get_my_org_id() and is_org_admin_or_above())
  with check (org_id = get_my_org_id() and is_org_admin_or_above());

create policy "profile: super admin can manage all"
  on profiles for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- ============================================================
-- TEAMS
-- ============================================================

create policy "teams: org members can view non-private teams"
  on teams for select to authenticated
  using (org_id = get_my_org_id() and (not is_private or id in (
    select team_id from team_members where user_id = auth.uid()
  )));

create policy "teams: leaders can create"
  on teams for insert to authenticated
  with check (org_id = get_my_org_id() and is_team_leader_or_above());

create policy "teams: leaders can update their teams"
  on teams for update to authenticated
  using (org_id = get_my_org_id() and (
    created_by = auth.uid() or is_dept_head_or_above()
  ));

-- ============================================================
-- TASKS
-- ============================================================

create policy "tasks: org members can view"
  on tasks for select to authenticated
  using (org_id = get_my_org_id());

create policy "tasks: members can create"
  on tasks for insert to authenticated
  with check (org_id = get_my_org_id() and created_by = auth.uid());

create policy "tasks: assignees and creators can update"
  on tasks for update to authenticated
  using (org_id = get_my_org_id() and (
    created_by = auth.uid()
    or id in (select task_id from task_assignees where user_id = auth.uid())
    or is_team_leader_or_above()
  ));

create policy "tasks: creators and admins can delete"
  on tasks for delete to authenticated
  using (org_id = get_my_org_id() and (
    created_by = auth.uid() or is_dept_head_or_above()
  ));

-- Task assignees
create policy "task_assignees: org members can view"
  on task_assignees for select to authenticated
  using (task_id in (select id from tasks where org_id = get_my_org_id()));

create policy "task_assignees: leaders can assign"
  on task_assignees for insert to authenticated
  with check (is_team_leader_or_above());

create policy "task_assignees: leaders can remove"
  on task_assignees for delete to authenticated
  using (is_team_leader_or_above() or user_id = auth.uid());

-- Task comments
create policy "task_comments: org members can view"
  on task_comments for select to authenticated
  using (task_id in (select id from tasks where org_id = get_my_org_id()));

create policy "task_comments: org members can create"
  on task_comments for insert to authenticated
  with check (user_id = auth.uid() and task_id in (select id from tasks where org_id = get_my_org_id()));

create policy "task_comments: owners can update/delete"
  on task_comments for all to authenticated
  using (user_id = auth.uid() or is_dept_head_or_above());

-- ============================================================
-- CHANNELS & MESSAGES
-- ============================================================

create policy "channels: members can view their channels"
  on channels for select to authenticated
  using (org_id = get_my_org_id() and (
    not is_private or id in (select channel_id from channel_members where user_id = auth.uid())
  ));

create policy "channels: leaders can create"
  on channels for insert to authenticated
  with check (org_id = get_my_org_id());

create policy "messages: channel members can view"
  on messages for select to authenticated
  using (channel_id in (select channel_id from channel_members where user_id = auth.uid()));

create policy "messages: channel members can send"
  on messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and channel_id in (select channel_id from channel_members where user_id = auth.uid())
  );

create policy "messages: owners can edit/delete"
  on messages for update to authenticated
  using (user_id = auth.uid() or is_dept_head_or_above());

-- ============================================================
-- FORM TEMPLATES
-- ============================================================

create policy "forms: org members can view active forms"
  on form_templates for select to authenticated
  using (org_id = get_my_org_id() and is_active);

create policy "forms: dept heads can manage"
  on form_templates for all to authenticated
  using (org_id = get_my_org_id() and is_dept_head_or_above())
  with check (org_id = get_my_org_id() and is_dept_head_or_above());

-- Form submissions
create policy "submissions: users can view own submissions"
  on form_submissions for select to authenticated
  using (submitted_by = auth.uid() or is_dept_head_or_above());

create policy "submissions: users can create"
  on form_submissions for insert to authenticated
  with check (submitted_by = auth.uid());

create policy "submissions: users can update own drafts"
  on form_submissions for update to authenticated
  using (
    (submitted_by = auth.uid() and status = 'draft')
    or (is_dept_head_or_above() and (reviewer_id = auth.uid() or is_org_admin_or_above()))
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create policy "notifications: users can view own"
  on notifications for select to authenticated
  using (user_id = auth.uid());

create policy "notifications: users can update own (mark read)"
  on notifications for update to authenticated
  using (user_id = auth.uid());

create policy "notifications: system can insert"
  on notifications for insert to authenticated
  with check (true);

-- ============================================================
-- REMINDERS
-- ============================================================

create policy "reminders: users manage own"
  on reminders for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- EVENTS
-- ============================================================

create policy "events: org members can view"
  on events for select to authenticated
  using (org_id = get_my_org_id());

create policy "events: members can create"
  on events for insert to authenticated
  with check (org_id = get_my_org_id() and created_by = auth.uid());

create policy "events: creators and admins can manage"
  on events for all to authenticated
  using (org_id = get_my_org_id() and (created_by = auth.uid() or is_dept_head_or_above()));

-- ============================================================
-- FILES
-- ============================================================

create policy "files: org members can view"
  on files for select to authenticated
  using (org_id = get_my_org_id());

create policy "files: members can upload"
  on files for insert to authenticated
  with check (org_id = get_my_org_id() and uploaded_by = auth.uid());

create policy "files: uploaders and admins can manage"
  on files for all to authenticated
  using (org_id = get_my_org_id() and (uploaded_by = auth.uid() or is_dept_head_or_above()));

-- ============================================================
-- AUDIT LOGS
-- ============================================================

create policy "audit: admins can view org logs"
  on audit_logs for select to authenticated
  using (org_id = get_my_org_id() and is_org_admin_or_above());

create policy "audit: system can insert"
  on audit_logs for insert to authenticated
  with check (true);
