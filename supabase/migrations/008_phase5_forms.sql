-- ============================================================
-- OASIS Hub - Phase 5: Inspection Forms Functions
-- ============================================================

-- Allow form_assignments insert by dept_head+
create policy "form_assignments: dept heads can manage"
  on form_assignments for all to authenticated
  using (is_dept_head_or_above())
  with check (is_dept_head_or_above());

-- Allow assigned users/team members to view their assignments
create policy "form_assignments: assigned users can view"
  on form_assignments for select to authenticated
  using (
    assigned_to = auth.uid()
    or assigned_team in (
      select team_id from team_members where user_id = auth.uid()
    )
  );

-- Get submission stats for a form
create or replace function get_form_stats(p_form_id uuid)
returns jsonb as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'total', count(*),
    'draft', count(*) filter (where status = 'draft'),
    'submitted', count(*) filter (where status = 'submitted'),
    'in_review', count(*) filter (where status = 'in_review'),
    'approved', count(*) filter (where status = 'approved'),
    'rejected', count(*) filter (where status = 'rejected'),
    'avg_score', round(avg(score)::numeric, 1)
  )
  into v_result
  from form_submissions
  where form_id = p_form_id;

  return v_result;
end;
$$ language plpgsql security definer;

-- Notify user when form is assigned to them
create or replace function notify_form_assigned()
returns trigger as $$
declare
  v_form_title text;
  v_assigner_name text;
begin
  select title into v_form_title from form_templates where id = new.form_id;
  select full_name into v_assigner_name from profiles where id = new.created_by;

  if new.assigned_to is not null then
    perform create_notification(
      new.assigned_to,
      'form_assigned',
      'New form assigned: ' || coalesce(v_form_title, 'Untitled'),
      'Assigned by ' || coalesce(v_assigner_name, 'Admin')
        || case when new.due_date is not null then ' — Due ' || to_char(new.due_date, 'Mon DD') else '' end,
      jsonb_build_object('form_id', new.form_id, 'assignment_id', new.id)
    );
  end if;

  -- Notify team members if assigned to a team
  if new.assigned_team is not null then
    insert into notifications (user_id, type, title, body, data)
    select
      tm.user_id,
      'form_assigned',
      'New form assigned to your team: ' || coalesce(v_form_title, 'Untitled'),
      'Assigned by ' || coalesce(v_assigner_name, 'Admin'),
      jsonb_build_object('form_id', new.form_id, 'assignment_id', new.id)
    from team_members tm
    where tm.team_id = new.assigned_team;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_form_assigned
  after insert on form_assignments
  for each row execute function notify_form_assigned();

-- Notify reviewer when form is submitted
create or replace function notify_form_submitted()
returns trigger as $$
declare
  v_form_title text;
  v_submitter_name text;
  v_dept_id uuid;
begin
  if new.status = 'submitted' and (old.status = 'draft' or old.status is null) then
    select title, dept_id into v_form_title, v_dept_id from form_templates where id = new.form_id;
    select full_name into v_submitter_name from profiles where id = new.submitted_by;

    -- Notify dept heads of the form's department
    insert into notifications (user_id, type, title, body, data)
    select
      p.id,
      'form_submitted',
      coalesce(v_submitter_name, 'Someone') || ' submitted: ' || coalesce(v_form_title, 'a form'),
      'Awaiting your review',
      jsonb_build_object('form_id', new.form_id, 'submission_id', new.id)
    from profiles p
    where p.org_id = (select org_id from form_templates where id = new.form_id)
      and p.role in ('super_admin', 'org_admin', 'dept_head')
      and (v_dept_id is null or p.id in (
        select created_by from departments where id = v_dept_id
      ));
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_notify_form_submitted
  after update on form_submissions
  for each row execute function notify_form_submitted();
