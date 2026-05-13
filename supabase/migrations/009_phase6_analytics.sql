-- ============================================================
-- OASIS Hub - Phase 6: Analytics Functions
-- ============================================================

-- Org-wide task summary stats
create or replace function get_org_task_stats(p_org_id uuid)
returns jsonb as $$
begin
  return (
    select jsonb_build_object(
      'total', count(*),
      'todo', count(*) filter (where status = 'todo'),
      'in_progress', count(*) filter (where status = 'in_progress'),
      'in_review', count(*) filter (where status = 'in_review'),
      'done', count(*) filter (where status = 'done'),
      'cancelled', count(*) filter (where status = 'cancelled'),
      'overdue', count(*) filter (where due_date < now() and status not in ('done','cancelled')),
      'urgent', count(*) filter (where priority = 'urgent' and status not in ('done','cancelled')),
      'high', count(*) filter (where priority = 'high' and status not in ('done','cancelled'))
    )
    from tasks
    where org_id = p_org_id
  );
end;
$$ language plpgsql security definer;

-- Tasks completed per day for last N days
create or replace function get_task_completion_trend(p_org_id uuid, p_days int default 30)
returns table(day date, completed bigint, created bigint) as $$
begin
  return query
  select
    d::date as day,
    count(t.id) filter (where t.status = 'done' and t.updated_at::date = d::date) as completed,
    count(t2.id) filter (where t2.created_at::date = d::date) as created
  from generate_series(now() - (p_days || ' days')::interval, now(), '1 day'::interval) d
  left join tasks t on t.org_id = p_org_id and t.updated_at::date = d::date and t.status = 'done'
  left join tasks t2 on t2.org_id = p_org_id and t2.created_at::date = d::date
  group by d
  order by d;
end;
$$ language plpgsql security definer;

-- Per-team task stats
create or replace function get_team_task_stats(p_org_id uuid)
returns table(team_id uuid, team_name text, total bigint, done bigint, overdue bigint) as $$
begin
  return query
  select
    te.id as team_id,
    te.name as team_name,
    count(t.id) as total,
    count(t.id) filter (where t.status = 'done') as done,
    count(t.id) filter (where t.due_date < now() and t.status not in ('done','cancelled')) as overdue
  from teams te
  left join tasks t on t.team_id = te.id
  where te.org_id = p_org_id
  group by te.id, te.name
  order by total desc
  limit 10;
end;
$$ language plpgsql security definer;

-- Top contributors (most tasks completed)
create or replace function get_top_contributors(p_org_id uuid, p_limit int default 10)
returns table(user_id uuid, full_name text, avatar_url text, completed bigint, in_progress bigint) as $$
begin
  return query
  select
    p.id as user_id,
    p.full_name,
    p.avatar_url,
    count(ta.task_id) filter (where t.status = 'done') as completed,
    count(ta.task_id) filter (where t.status = 'in_progress') as in_progress
  from profiles p
  join task_assignees ta on ta.user_id = p.id
  join tasks t on t.id = ta.task_id and t.org_id = p_org_id
  where p.org_id = p_org_id
  group by p.id, p.full_name, p.avatar_url
  order by completed desc
  limit p_limit;
end;
$$ language plpgsql security definer;

-- Form submission stats by department
create or replace function get_form_stats_by_dept(p_org_id uuid)
returns table(dept_name text, total bigint, approved bigint, rejected bigint, avg_score numeric) as $$
begin
  return query
  select
    coalesce(d.name, 'General') as dept_name,
    count(fs.id) as total,
    count(fs.id) filter (where fs.status = 'approved') as approved,
    count(fs.id) filter (where fs.status = 'rejected') as rejected,
    round(avg(fs.score), 1) as avg_score
  from form_templates ft
  left join form_submissions fs on fs.form_id = ft.id
  left join departments d on d.id = ft.dept_id
  where ft.org_id = p_org_id
  group by d.name
  order by total desc;
end;
$$ language plpgsql security definer;
