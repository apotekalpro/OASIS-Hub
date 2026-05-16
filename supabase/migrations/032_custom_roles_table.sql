-- 1. roles table
CREATE TABLE IF NOT EXISTS roles (
  slug text PRIMARY KEY,
  label text NOT NULL,
  level int NOT NULL,
  color text NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
  is_system bool NOT NULL DEFAULT false,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed system roles (match existing ROLE_HIERARCHY levels exactly)
INSERT INTO roles (slug, label, level, color, is_system) VALUES
  ('super_admin', 'Super Admin', 100, 'bg-red-100 text-red-800', true),
  ('org_admin', 'Org Admin', 80, 'bg-purple-100 text-purple-800', true),
  ('dept_head', 'Department Head', 60, 'bg-blue-100 text-blue-800', true),
  ('chief', 'Chief', 60, 'bg-indigo-100 text-indigo-800', true),
  ('area_manager', 'Area Manager', 55, 'bg-teal-100 text-teal-800', true),
  ('lead', 'Lead / Supervisor', 50, 'bg-cyan-100 text-cyan-800', true),
  ('team_leader', 'Team Leader', 40, 'bg-green-100 text-green-800', true),
  ('auditor', 'Auditor', 35, 'bg-yellow-100 text-yellow-800', true),
  ('member', 'Member', 20, 'bg-gray-100 text-gray-800', true),
  ('viewer', 'Viewer', 10, 'bg-slate-100 text-slate-600', true),
  ('outlet', 'Outlet', 5, 'bg-orange-100 text-orange-800', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Add role_level to profiles (fast middleware check without join)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_level int NOT NULL DEFAULT 20;

-- 4. Backfill role_level for existing profiles
UPDATE profiles p SET role_level = r.level FROM roles r WHERE r.slug = p.role::text;

-- 5. Convert profiles.role from enum → text (allows custom role slugs)
ALTER TABLE profiles ALTER COLUMN role TYPE text USING role::text;

-- 6. Trigger: keep role_level in sync when role changes
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

-- 7. RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read roles" ON roles FOR SELECT USING (
  org_id IS NULL OR
  org_id = (SELECT org_id FROM profiles WHERE id = auth.uid() LIMIT 1)
);
CREATE POLICY "admins can manage custom roles" ON roles FOR ALL USING (
  is_system = false AND
  (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('super_admin', 'org_admin')
) WITH CHECK (
  is_system = false AND
  (SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1) IN ('super_admin', 'org_admin')
);
