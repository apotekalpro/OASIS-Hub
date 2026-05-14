-- Add 'lead' value to the user_role enum
-- PostgreSQL requires ALTER TYPE for enum changes
alter type user_role add value if not exists 'lead' after 'dept_head';

-- Update the is_dept_head_or_above() helper so 'lead' is included
-- (lead should have the same baseline access as dept_head)
create or replace function is_dept_head_or_above()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('super_admin', 'org_admin', 'dept_head', 'lead')
  );
$$;
