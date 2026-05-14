-- ============================================================
-- Inspection Schedule Assignment Enhancements
-- Allow assigning by role/dept or specific user
-- Allow outlet scope: specific, all, or assignee's area
-- ============================================================

-- Make outlet_id nullable (supports 'all' and 'assignee_area' scopes)
alter table inspection_schedules
  alter column outlet_id drop not null;

-- outlet_scope: 'specific' | 'all' | 'assignee_area'
alter table inspection_schedules
  add column if not exists outlet_scope text not null default 'specific'
    check (outlet_scope in ('specific', 'all', 'assignee_area'));

-- assign_type: 'any' | 'user' | 'role'
alter table inspection_schedules
  add column if not exists assign_type text not null default 'any'
    check (assign_type in ('any', 'user', 'role'));

-- For role-based assignment
alter table inspection_schedules
  add column if not exists assigned_role text;

alter table inspection_schedules
  add column if not exists assigned_dept_id uuid references departments(id) on delete set null;

-- due_hours: how many hours after the scheduled time the task must be completed
alter table inspection_schedules
  add column if not exists due_hours integer;

-- Drop old unique constraint that required outlet_id
alter table inspection_schedules
  drop constraint if exists inspection_schedules_template_id_outlet_id_frequency_scheduled_key;
