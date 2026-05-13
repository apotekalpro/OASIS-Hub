-- Table
create table if not exists feature_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  feature text not null,  -- 'teams','outlets','checklists','schedules','analytics'
  min_role text not null default 'dept_head',
  updated_at timestamptz default now(),
  unique(org_id, feature)
);

-- RLS
alter table feature_permissions enable row level security;

create policy "feature_permissions: org members can view" on feature_permissions
  for select to authenticated using (org_id = get_my_org_id());

create policy "feature_permissions: org_admin can manage" on feature_permissions
  for all to authenticated
  using (org_id = get_my_org_id() and is_org_admin_or_above())
  with check (org_id = get_my_org_id() and is_org_admin_or_above());

-- Helper function: get feature permissions as JSON for an org
create or replace function get_feature_permissions(p_org_id uuid)
returns json
language sql
security definer
stable
as $$
  select json_object_agg(feature, min_role)
  from feature_permissions
  where org_id = p_org_id;
$$;
