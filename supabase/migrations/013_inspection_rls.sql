-- ============================================================
-- OASIS Hub — RLS policies for Inspection Module
-- ============================================================

alter table outlets enable row level security;
alter table outlet_staff enable row level security;
alter table inspection_templates enable row level security;
alter table template_sections enable row level security;
alter table template_questions enable row level security;
alter table inspection_schedules enable row level security;
alter table inspection_sessions enable row level security;
alter table session_responses enable row level security;
alter table inspection_issues enable row level security;
alter table issue_escalations enable row level security;
alter table issue_comments enable row level security;
alter table escalation_rules enable row level security;

-- ============================================================
-- OUTLETS
-- ============================================================

create policy "outlets: org members can view active"
  on outlets for select to authenticated
  using (org_id = get_my_org_id());

create policy "outlets: admins can manage"
  on outlets for all to authenticated
  using (org_id = get_my_org_id() and is_dept_head_or_above())
  with check (org_id = get_my_org_id() and is_dept_head_or_above());

-- ============================================================
-- OUTLET STAFF
-- ============================================================

create policy "outlet_staff: org members can view assignments"
  on outlet_staff for select to authenticated
  using (outlet_id in (select id from outlets where org_id = get_my_org_id()));

create policy "outlet_staff: admins can manage assignments"
  on outlet_staff for all to authenticated
  using (outlet_id in (select id from outlets where org_id = get_my_org_id()) and is_dept_head_or_above())
  with check (outlet_id in (select id from outlets where org_id = get_my_org_id()) and is_dept_head_or_above());

-- ============================================================
-- INSPECTION TEMPLATES
-- ============================================================

create policy "templates: org members can view active"
  on inspection_templates for select to authenticated
  using (org_id = get_my_org_id() and is_active = true);

create policy "templates: admins can view all including inactive"
  on inspection_templates for select to authenticated
  using (org_id = get_my_org_id() and is_dept_head_or_above());

create policy "templates: admins can manage"
  on inspection_templates for all to authenticated
  using (org_id = get_my_org_id() and is_dept_head_or_above())
  with check (org_id = get_my_org_id() and is_dept_head_or_above());

-- ============================================================
-- TEMPLATE SECTIONS & QUESTIONS (scoped through template)
-- ============================================================

create policy "template_sections: org members can view"
  on template_sections for select to authenticated
  using (template_id in (select id from inspection_templates where org_id = get_my_org_id()));

create policy "template_sections: admins can manage"
  on template_sections for all to authenticated
  using (template_id in (select id from inspection_templates where org_id = get_my_org_id() and is_dept_head_or_above()))
  with check (template_id in (select id from inspection_templates where org_id = get_my_org_id() and is_dept_head_or_above()));

create policy "template_questions: org members can view"
  on template_questions for select to authenticated
  using (template_id in (select id from inspection_templates where org_id = get_my_org_id()));

create policy "template_questions: admins can manage"
  on template_questions for all to authenticated
  using (template_id in (select id from inspection_templates where org_id = get_my_org_id() and is_dept_head_or_above()))
  with check (template_id in (select id from inspection_templates where org_id = get_my_org_id() and is_dept_head_or_above()));

-- ============================================================
-- INSPECTION SCHEDULES
-- ============================================================

create policy "schedules: org members can view their schedules"
  on inspection_schedules for select to authenticated
  using (
    org_id = get_my_org_id() and (
      is_dept_head_or_above()
      or assigned_to = auth.uid()
      or outlet_id in (select outlet_id from outlet_staff where user_id = auth.uid())
    )
  );

create policy "schedules: admins can manage"
  on inspection_schedules for all to authenticated
  using (org_id = get_my_org_id() and is_dept_head_or_above())
  with check (org_id = get_my_org_id() and is_dept_head_or_above());

-- ============================================================
-- INSPECTION SESSIONS
-- ============================================================

create policy "sessions: org members can view"
  on inspection_sessions for select to authenticated
  using (
    org_id = get_my_org_id() and (
      is_dept_head_or_above()
      or conducted_by = auth.uid()
      or outlet_id in (select outlet_id from outlet_staff where user_id = auth.uid())
    )
  );

create policy "sessions: staff can create for their outlets"
  on inspection_sessions for insert to authenticated
  with check (
    org_id = get_my_org_id()
    and conducted_by = auth.uid()
    and (
      is_dept_head_or_above()
      or outlet_id in (select outlet_id from outlet_staff where user_id = auth.uid())
    )
  );

create policy "sessions: conductor can update in-progress"
  on inspection_sessions for update to authenticated
  using (
    org_id = get_my_org_id() and (
      (conducted_by = auth.uid() and status in ('not_started', 'in_progress'))
      or is_dept_head_or_above()
    )
  );

-- ============================================================
-- SESSION RESPONSES
-- ============================================================

create policy "responses: can view their session responses"
  on session_responses for select to authenticated
  using (
    session_id in (
      select id from inspection_sessions where org_id = get_my_org_id() and (
        is_dept_head_or_above()
        or conducted_by = auth.uid()
        or outlet_id in (select outlet_id from outlet_staff where user_id = auth.uid())
      )
    )
  );

create policy "responses: conductor can insert/update their session"
  on session_responses for all to authenticated
  using (
    session_id in (
      select id from inspection_sessions where conducted_by = auth.uid() and status in ('not_started', 'in_progress')
    )
  )
  with check (
    session_id in (
      select id from inspection_sessions where conducted_by = auth.uid() and status in ('not_started', 'in_progress')
    )
  );

-- ============================================================
-- INSPECTION ISSUES
-- ============================================================

create policy "issues: org members can view"
  on inspection_issues for select to authenticated
  using (org_id = get_my_org_id());

create policy "issues: members can create"
  on inspection_issues for insert to authenticated
  with check (org_id = get_my_org_id() and raised_by = auth.uid());

create policy "issues: assigned user and admins can update"
  on inspection_issues for update to authenticated
  using (
    org_id = get_my_org_id() and (
      assigned_to = auth.uid()
      or raised_by = auth.uid()
      or is_dept_head_or_above()
    )
  );

create policy "issues: admins can delete"
  on inspection_issues for delete to authenticated
  using (org_id = get_my_org_id() and is_dept_head_or_above());

-- ============================================================
-- ISSUE ESCALATIONS & COMMENTS
-- ============================================================

create policy "escalations: org members can view"
  on issue_escalations for select to authenticated
  using (issue_id in (select id from inspection_issues where org_id = get_my_org_id()));

create policy "escalations: system can insert"
  on issue_escalations for insert to authenticated
  with check (issue_id in (select id from inspection_issues where org_id = get_my_org_id()));

create policy "comments: org members can view"
  on issue_comments for select to authenticated
  using (issue_id in (select id from inspection_issues where org_id = get_my_org_id()));

create policy "comments: members can post"
  on issue_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and issue_id in (select id from inspection_issues where org_id = get_my_org_id())
  );

create policy "comments: owner can update/delete"
  on issue_comments for all to authenticated
  using (user_id = auth.uid() or is_dept_head_or_above());

-- ============================================================
-- ESCALATION RULES
-- ============================================================

create policy "escalation_rules: org members can view"
  on escalation_rules for select to authenticated
  using (org_id = get_my_org_id());

create policy "escalation_rules: admins can manage"
  on escalation_rules for all to authenticated
  using (org_id = get_my_org_id() and is_org_admin_or_above())
  with check (org_id = get_my_org_id() and is_org_admin_or_above());

-- ============================================================
-- DEFAULT ESCALATION RULES (inserted per org on first use)
-- Helper function called when first outlet is created
-- ============================================================

create or replace function seed_default_escalation_rules(p_org_id uuid)
returns void as $$
begin
  insert into escalation_rules (org_id, severity, level, escalate_after_hours, escalate_to_role)
  values
    -- Critical: escalate fast
    (p_org_id, 'critical', 1, 2,  'dept_head'),
    (p_org_id, 'critical', 2, 6,  'org_admin'),
    (p_org_id, 'critical', 3, 24, 'super_admin'),
    -- High
    (p_org_id, 'high', 1, 24,  'dept_head'),
    (p_org_id, 'high', 2, 72,  'org_admin'),
    (p_org_id, 'high', 3, 168, 'super_admin'),
    -- Medium (Nimbly defaults: 1d→3d→7d)
    (p_org_id, 'medium', 1, 24,  'dept_head'),
    (p_org_id, 'medium', 2, 72,  'org_admin'),
    (p_org_id, 'medium', 3, 168, 'super_admin'),
    -- Low
    (p_org_id, 'low', 1, 72,  'dept_head'),
    (p_org_id, 'low', 2, 168, 'org_admin')
  on conflict (org_id, severity, level) do nothing;
end;
$$ language plpgsql security definer;
