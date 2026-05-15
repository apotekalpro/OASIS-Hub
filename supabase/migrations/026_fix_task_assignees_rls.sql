-- Allow task creators (not just leaders) to manage assignees on their own tasks.
-- Also include watchers in task visibility so CC spectators can view tasks.

-- ──────────────────────────────────────────────────────────────
-- TASK ASSIGNEES: creators can assign/remove on their own tasks
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_assignees: leaders can assign" ON task_assignees;
CREATE POLICY "task_assignees: creators and leaders can assign"
  ON task_assignees FOR INSERT TO authenticated
  WITH CHECK (
    is_team_leader_or_above()
    OR task_id IN (SELECT id FROM tasks WHERE created_by = auth.uid())
  );

DROP POLICY IF EXISTS "task_assignees: leaders can remove" ON task_assignees;
CREATE POLICY "task_assignees: creators and leaders can remove"
  ON task_assignees FOR DELETE TO authenticated
  USING (
    is_team_leader_or_above()
    OR user_id = auth.uid()
    OR task_id IN (SELECT id FROM tasks WHERE created_by = auth.uid())
  );

-- ──────────────────────────────────────────────────────────────
-- TASKS: include watchers in visibility
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks: org members can view" ON tasks;
CREATE POLICY "tasks: org members can view"
  ON tasks FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR org_id = get_my_org_id()
    OR created_by = auth.uid()
    OR id IN (SELECT task_id FROM task_assignees WHERE user_id = auth.uid())
    OR id IN (SELECT task_id FROM task_watchers  WHERE user_id = auth.uid())
  );

-- Allow watchers to comment on tasks
DROP POLICY IF EXISTS "task_comments: org members can view" ON task_comments;
CREATE POLICY "task_comments: org members can view"
  ON task_comments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin()
    OR task_id IN (
      SELECT id FROM tasks
      WHERE org_id = get_my_org_id()
         OR created_by = auth.uid()
         OR id IN (SELECT task_id FROM task_assignees WHERE user_id = auth.uid())
         OR id IN (SELECT task_id FROM task_watchers  WHERE user_id = auth.uid())
    )
  );
