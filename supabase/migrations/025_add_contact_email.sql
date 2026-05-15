-- Add contact_email column for notification/invitation emails
-- The existing email column remains the login email (linked to Supabase Auth)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_email text;
