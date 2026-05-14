-- Fix tasks RLS policies so super_admin (org_id = null) can see tasks.
-- Also allow any user to see tasks they created or are assigned to,
-- regardless of org_id match (handles edge cases like org migration).

-- ============================================================
-- TASKS
-- ============================================================

drop policy if exists "tasks: org members can view" on tasks;
create policy "tasks: org members can view"
  on tasks for select to authenticated
  using (
    is_super_admin()
    or org_id = get_my_org_id()
    or created_by = auth.uid()
    or id in (select task_id from task_assignees where user_id = auth.uid())
  );

drop policy if exists "tasks: members can create" on tasks;
create policy "tasks: members can create"
  on tasks for insert to authenticated
  with check (
    created_by = auth.uid()
    and (is_super_admin() or org_id = get_my_org_id())
  );

drop policy if exists "tasks: assignees and creators can update" on tasks;
create policy "tasks: assignees and creators can update"
  on tasks for update to authenticated
  using (
    is_super_admin()
    or (
      (org_id = get_my_org_id() or created_by = auth.uid())
      and (
        created_by = auth.uid()
        or id in (select task_id from task_assignees where user_id = auth.uid())
        or is_team_leader_or_above()
      )
    )
  );

drop policy if exists "tasks: creators and admins can delete" on tasks;
create policy "tasks: creators and admins can delete"
  on tasks for delete to authenticated
  using (
    is_super_admin()
    or (
      (org_id = get_my_org_id() or created_by = auth.uid())
      and (created_by = auth.uid() or is_dept_head_or_above())
    )
  );

-- ============================================================
-- TASK ASSIGNEES
-- ============================================================

drop policy if exists "task_assignees: org members can view" on task_assignees;
create policy "task_assignees: org members can view"
  on task_assignees for select to authenticated
  using (
    user_id = auth.uid()
    or is_super_admin()
    or task_id in (
      select id from tasks
      where org_id = get_my_org_id()
         or created_by = auth.uid()
    )
  );

-- ============================================================
-- TASK COMMENTS
-- ============================================================

drop policy if exists "task_comments: org members can view" on task_comments;
create policy "task_comments: org members can view"
  on task_comments for select to authenticated
  using (
    user_id = auth.uid()
    or is_super_admin()
    or task_id in (
      select id from tasks
      where org_id = get_my_org_id()
         or created_by = auth.uid()
         or id in (select task_id from task_assignees where user_id = auth.uid())
    )
  );

drop policy if exists "task_comments: org members can create" on task_comments;
create policy "task_comments: org members can create"
  on task_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      is_super_admin()
      or task_id in (
        select id from tasks
        where org_id = get_my_org_id()
           or created_by = auth.uid()
           or id in (select task_id from task_assignees where user_id = auth.uid())
      )
    )
  );
