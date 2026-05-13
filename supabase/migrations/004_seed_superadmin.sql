-- ============================================================
-- OASIS Hub - Seed: Default Organization & Super Admin
-- NOTE: Replace values before running in production.
-- Super Admin is created via Supabase Auth Dashboard or API.
-- This sets up the default organization only.
-- ============================================================

insert into organizations (id, name, slug, settings)
values (
  '00000000-0000-0000-0000-000000000001',
  'OASIS Hub',
  'oasis-hub',
  '{
    "allow_guest_access": false,
    "default_timezone": "Asia/Kuala_Lumpur",
    "enable_email_notifications": true,
    "max_file_size_mb": 50
  }'::jsonb
) on conflict do nothing;
