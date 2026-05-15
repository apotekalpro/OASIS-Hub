-- Fix outlet_staff SELECT policy: members should only see their own assignments
-- (prevents non-admins from querying other users' outlet assignments)
DROP POLICY IF EXISTS "outlet_staff: org members can view assignments" ON outlet_staff;

CREATE POLICY "outlet_staff: members see own, admins see all"
  ON outlet_staff FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR is_dept_head_or_above()
  );
