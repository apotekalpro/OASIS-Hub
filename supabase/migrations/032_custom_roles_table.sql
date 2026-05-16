-- Migration 032: Dynamic roles table with custom role support
-- NOTE: profiles.role is converted from enum → text to allow custom role slugs.
-- All policies and functions that depend on the enum type are dropped and recreated.

-- ─── Step 1: Create roles table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  slug      text PRIMARY KEY,
  label     text NOT NULL,
  level     int  NOT NULL,
  color     text NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
  is_system bool NOT NULL DEFAULT false,
  org_id    uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Step 2: Seed system roles ───────────────────────────────────────────────
INSERT INTO roles (slug, label, level, color, is_system) VALUES
  ('super_admin',  'Super Admin',        100, 'bg-red-100 text-red-800',      true),
  ('org_admin',    'Org Admin',           80, 'bg-purple-100 text-purple-800', true),
  ('dept_head',    'Department Head',     60, 'bg-blue-100 text-blue-800',    true),
  ('chief',        'Chief',               60, 'bg-indigo-100 text-indigo-800', true),
  ('area_manager', 'Area Manager',        55, 'bg-teal-100 text-teal-800',    true),
  ('lead',         'Lead / Supervisor',   50, 'bg-cyan-100 text-cyan-800',    true),
  ('team_leader',  'Team Leader',         40, 'bg-green-100 text-green-800',  true),
  ('auditor',      'Auditor',             35, 'bg-yellow-100 text-yellow-800', true),
  ('member',       'Member',              20, 'bg-gray-100 text-gray-800',    true),
  ('viewer',       'Viewer',              10, 'bg-slate-100 text-slate-600',  true),
  ('outlet',       'Outlet',               5, 'bg-orange-100 text-orange-800', true)
ON CONFLICT (slug) DO NOTHING;

-- ─── Step 3: Add role_level to profiles ──────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_level int NOT NULL DEFAULT 20;

-- ─── Step 4: Backfill role_level for existing rows ───────────────────────────
UPDATE profiles p
SET role_level = r.level
FROM roles r
WHERE r.slug = p.role::text;

-- ─── Step 5: Drop objects that block the enum → text conversion ──────────────

-- get_my_role() declares "returns user_role" (the enum type) — must drop first
DROP FUNCTION IF EXISTS get_my_role() CASCADE;

-- This policy directly queries profiles.role as an enum column
DROP POLICY IF EXISTS "org_admin_manage_chief_departments" ON public.chief_departments;

-- This policy uses "role = (select role from profiles …)" — enum self-reference
DROP POLICY IF EXISTS "profile: can update own profile" ON public.profiles;

-- ─── Step 6: Convert profiles.role from enum → text ─────────────────────────
ALTER TABLE profiles ALTER COLUMN role TYPE text USING role::text;

-- ─── Step 7: Recreate get_my_role() returning text ───────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Step 8: Update helper functions to use role_level ───────────────────────
-- role_level comparisons automatically support custom roles once assigned a level

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT role_level >= 100 FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin_or_above()
RETURNS boolean AS $$
  SELECT role_level >= 80 FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_dept_head_or_above()
RETURNS boolean AS $$
  SELECT role_level >= 60 FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_team_leader_or_above()
RETURNS boolean AS $$
  SELECT role_level >= 40 FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Step 9: Recreate dropped policies ───────────────────────────────────────

CREATE POLICY "profile: can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "org_admin_manage_chief_departments"
  ON public.chief_departments FOR ALL
  USING    (is_org_admin_or_above())
  WITH CHECK (is_org_admin_or_above());

-- ─── Step 10: Trigger to keep role_level in sync on role change ───────────────
CREATE OR REPLACE FUNCTION sync_profile_role_level()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT level INTO NEW.role_level FROM roles WHERE slug = NEW.role;
  IF NOT FOUND THEN NEW.role_level := 20; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_role_level ON profiles;
CREATE TRIGGER tr_sync_role_level
  BEFORE INSERT OR UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_role_level();

-- ─── Step 11: RLS for roles table ────────────────────────────────────────────
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles: anyone can read"
  ON roles FOR SELECT
  USING (org_id IS NULL OR org_id = get_my_org_id());

CREATE POLICY "roles: admins can manage custom"
  ON roles FOR ALL
  USING    (is_system = false AND is_org_admin_or_above())
  WITH CHECK (is_system = false AND is_org_admin_or_above());
