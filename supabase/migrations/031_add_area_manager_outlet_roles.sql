-- Migration 031: Add area_manager and outlet roles, link AMs to outlets

-- 1. Add new roles to the enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'area_manager' AFTER 'lead';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'outlet' AFTER 'viewer';

-- 2. Add area_manager_id FK to outlets (links an outlet to its Area Manager)
ALTER TABLE outlets
  ADD COLUMN IF NOT EXISTS area_manager_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outlets_area_manager_id_idx ON outlets(area_manager_id);

-- 3. Add outlet_id FK to profiles (links an Outlet user to their specific outlet)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS outlet_id uuid REFERENCES outlets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_outlet_id_idx ON profiles(outlet_id);

-- 4. RLS: area_manager can see their own outlets (SELECT) via area_manager_id
-- The existing "all org members can view active outlets" policy already covers this.
-- No additional RLS needed for read — area_manager just sees all active outlets.
-- The inspections page handles the filtering in app logic.

-- 5. Update is_dept_head_or_above to NOT include area_manager (they don't manage admin functions)
-- area_manager is below dept_head; existing function remains correct.
