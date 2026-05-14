-- Add chief role to the user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'chief';

-- Table for chief multi-department assignments
CREATE TABLE IF NOT EXISTS chief_departments (
  chief_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dept_id   uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  org_id    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chief_id, dept_id)
);

CREATE INDEX IF NOT EXISTS idx_chief_departments_chief_id ON chief_departments(chief_id);
CREATE INDEX IF NOT EXISTS idx_chief_departments_dept_id  ON chief_departments(dept_id);
CREATE INDEX IF NOT EXISTS idx_chief_departments_org_id   ON chief_departments(org_id);

ALTER TABLE chief_departments ENABLE ROW LEVEL SECURITY;

-- Org admins and super admins can manage chief assignments
CREATE POLICY "org_admin_manage_chief_departments"
  ON chief_departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'org_admin')
    )
  );

-- Anyone in the org can read
CREATE POLICY "org_members_read_chief_departments"
  ON chief_departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.org_id = chief_departments.org_id
    )
  );
