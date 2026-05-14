-- ============================================================
-- Fix infinite recursion in channel_members RLS policy
-- The SELECT policy was querying channel_members from within
-- a channel_members policy, causing infinite recursion.
-- Fix: use a security definer function to bypass RLS.
-- ============================================================

-- Helper: returns channel IDs the current user belongs to (bypasses RLS)
create or replace function get_my_channel_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select channel_id from channel_members where user_id = auth.uid();
$$;

-- Drop the recursive policy and replace it
drop policy if exists "channel_members: users can view memberships in their channels" on channel_members;

create policy "channel_members: users can view memberships in their channels"
  on channel_members for select to authenticated
  using (
    channel_id in (select get_my_channel_ids())
    or user_id = auth.uid()
  );
