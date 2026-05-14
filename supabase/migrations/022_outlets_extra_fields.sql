-- Add extra fields to outlets for Google Sheets sync
alter table outlets
  add column if not exists postcode text,
  add column if not exists email text,
  add column if not exists category text,
  add column if not exists area_manager_name text;

-- Unique constraint needed for upsert by (org_id, code) during Google Sheets sync
-- Only add if it doesn't already exist
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'outlets_org_id_code_key'
  ) then
    alter table outlets add constraint outlets_org_id_code_key unique (org_id, code);
  end if;
end $$;
