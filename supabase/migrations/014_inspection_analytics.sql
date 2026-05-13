-- ============================================================
-- OASIS Hub — Inspection Analytics Helper Functions
-- ============================================================

-- Issue Resolution Rate for an org
-- Returns percentage of issues that are resolved or closed
create or replace function get_inspection_irr(p_org_id uuid)
returns numeric as $$
  select case
    when count(*) = 0 then 0
    else round(
      count(*) filter (where status in ('resolved','closed'))::numeric / count(*)::numeric * 100,
      2
    )
  end
  from inspection_issues
  where org_id = p_org_id;
$$ language sql security definer stable;

-- Report Completion Rate for an org (sessions submitted / sessions created)
create or replace function get_inspection_rcr(p_org_id uuid)
returns numeric as $$
  select case
    when count(*) = 0 then 0
    else round(
      count(*) filter (where status in ('submitted','approved'))::numeric / count(*)::numeric * 100,
      2
    )
  end
  from inspection_sessions
  where org_id = p_org_id;
$$ language sql security definer stable;

-- Issue counts by severity
create or replace function get_issues_by_severity(p_org_id uuid)
returns table(severity text, total bigint, open_count bigint, resolved_count bigint) as $$
  select
    severity::text,
    count(*) as total,
    count(*) filter (where status in ('open','in_progress','escalated')) as open_count,
    count(*) filter (where status in ('resolved','closed')) as resolved_count
  from inspection_issues
  where org_id = p_org_id
  group by severity
  order by
    case severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      when 'low' then 4
    end;
$$ language sql security definer stable;

-- Top outlets by open issues
create or replace function get_outlet_issue_stats(p_org_id uuid, p_limit int default 10)
returns table(
  outlet_id uuid, outlet_name text, outlet_code text,
  total_issues bigint, open_issues bigint, resolved_issues bigint,
  total_sessions bigint, completed_sessions bigint,
  completion_rate numeric, irr numeric
) as $$
  select
    o.id as outlet_id,
    o.name as outlet_name,
    coalesce(o.code, '') as outlet_code,
    coalesce(i.total_issues, 0) as total_issues,
    coalesce(i.open_issues, 0) as open_issues,
    coalesce(i.resolved_issues, 0) as resolved_issues,
    coalesce(s.total_sessions, 0) as total_sessions,
    coalesce(s.completed_sessions, 0) as completed_sessions,
    case when coalesce(s.total_sessions, 0) = 0 then 0
      else round(s.completed_sessions::numeric / s.total_sessions::numeric * 100, 1)
    end as completion_rate,
    case when coalesce(i.total_issues, 0) = 0 then 100
      else round(i.resolved_issues::numeric / i.total_issues::numeric * 100, 1)
    end as irr
  from outlets o
  left join (
    select outlet_id,
      count(*) as total_issues,
      count(*) filter (where status in ('open','in_progress','escalated')) as open_issues,
      count(*) filter (where status in ('resolved','closed')) as resolved_issues
    from inspection_issues
    where org_id = p_org_id
    group by outlet_id
  ) i on i.outlet_id = o.id
  left join (
    select outlet_id,
      count(*) as total_sessions,
      count(*) filter (where status in ('submitted','approved')) as completed_sessions
    from inspection_sessions
    where org_id = p_org_id
    group by outlet_id
  ) s on s.outlet_id = o.id
  where o.org_id = p_org_id and o.status = 'active'
  order by coalesce(i.open_issues, 0) desc
  limit p_limit;
$$ language sql security definer stable;

-- Daily issue trend for past N days
create or replace function get_issue_trend(p_org_id uuid, p_days int default 14)
returns table(
  day date,
  opened bigint,
  resolved bigint,
  escalated bigint,
  in_progress bigint
) as $$
  select
    gs.day::date,
    count(i.id) filter (where i.created_at::date = gs.day) as opened,
    count(i.id) filter (where i.resolved_at::date = gs.day) as resolved,
    count(i.id) filter (where i.status = 'escalated' and i.created_at::date = gs.day) as escalated,
    count(i.id) filter (where i.status = 'in_progress' and i.created_at::date = gs.day) as in_progress
  from generate_series(
    current_date - (p_days - 1) * interval '1 day',
    current_date,
    interval '1 day'
  ) gs(day)
  left join inspection_issues i on i.org_id = p_org_id
  group by gs.day
  order by gs.day;
$$ language sql security definer stable;

-- Daily session (report) trend for past N days
create or replace function get_session_trend(p_org_id uuid, p_days int default 14)
returns table(
  day date,
  scheduled bigint,
  completed bigint,
  missed bigint
) as $$
  select
    gs.day::date,
    count(s.id) filter (where s.created_at::date = gs.day) as scheduled,
    count(s.id) filter (where s.status in ('submitted','approved') and s.submitted_at::date = gs.day) as completed,
    count(s.id) filter (where s.status = 'not_started' and s.scheduled_for::date < current_date and s.created_at::date = gs.day) as missed
  from generate_series(
    current_date - (p_days - 1) * interval '1 day',
    current_date,
    interval '1 day'
  ) gs(day)
  left join inspection_sessions s on s.org_id = p_org_id
  group by gs.day
  order by gs.day;
$$ language sql security definer stable;

-- Average issue resolution time in hours
create or replace function get_avg_resolution_hours(p_org_id uuid)
returns numeric as $$
  select round(
    avg(extract(epoch from (resolved_at - created_at)) / 3600)::numeric,
    1
  )
  from inspection_issues
  where org_id = p_org_id
    and resolved_at is not null
    and status in ('resolved', 'closed');
$$ language sql security definer stable;

-- Top user performance by sessions conducted and issues raised
create or replace function get_user_inspection_stats(p_org_id uuid, p_limit int default 10)
returns table(
  user_id uuid, full_name text, avatar_url text,
  sessions_conducted bigint, sessions_completed bigint,
  issues_raised bigint, issues_resolved bigint,
  completion_rate numeric
) as $$
  select
    p.id as user_id,
    p.full_name,
    coalesce(p.avatar_url, '') as avatar_url,
    coalesce(s.sessions_conducted, 0) as sessions_conducted,
    coalesce(s.sessions_completed, 0) as sessions_completed,
    coalesce(i.issues_raised, 0) as issues_raised,
    coalesce(i.issues_resolved, 0) as issues_resolved,
    case when coalesce(s.sessions_conducted, 0) = 0 then 0
      else round(s.sessions_completed::numeric / s.sessions_conducted::numeric * 100, 1)
    end as completion_rate
  from profiles p
  left join (
    select conducted_by,
      count(*) as sessions_conducted,
      count(*) filter (where status in ('submitted','approved')) as sessions_completed
    from inspection_sessions
    where org_id = p_org_id
    group by conducted_by
  ) s on s.conducted_by = p.id
  left join (
    select raised_by,
      count(*) as issues_raised,
      count(*) filter (where status in ('resolved','closed')) as issues_resolved
    from inspection_issues
    where org_id = p_org_id
    group by raised_by
  ) i on i.raised_by = p.id
  where p.org_id = p_org_id and p.is_active = true
    and (coalesce(s.sessions_conducted, 0) > 0 or coalesce(i.issues_raised, 0) > 0)
  order by coalesce(s.sessions_completed, 0) desc
  limit p_limit;
$$ language sql security definer stable;
