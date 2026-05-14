-- ============================================================
-- Task Comment Enhancements: Reply threading & Emoji reactions
-- ============================================================

-- Add parent_comment_id for reply threading
alter table task_comments
  add column if not exists parent_comment_id uuid references task_comments(id) on delete cascade;

-- Emoji reactions on task comments
create table if not exists task_comment_reactions (
  id uuid primary key default uuid_generate_v4(),
  comment_id uuid not null references task_comments(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(comment_id, user_id, emoji)
);

create index if not exists idx_comment_reactions_comment on task_comment_reactions(comment_id);
create index if not exists idx_task_comments_parent on task_comments(parent_comment_id);

-- ============================================================
-- RLS policies
-- ============================================================
alter table task_comment_reactions enable row level security;

-- Members of the same org can see reactions on comments they can access
create policy "Org members can view comment reactions"
  on task_comment_reactions for select
  using (
    exists (
      select 1 from task_comments tc
      join tasks t on t.id = tc.task_id
      join profiles p on p.id = auth.uid()
      where tc.id = task_comment_reactions.comment_id
        and t.org_id = p.org_id
    )
  );

-- Users can add reactions
create policy "Users can add reactions"
  on task_comment_reactions for insert
  with check (user_id = auth.uid());

-- Users can remove their own reactions
create policy "Users can remove own reactions"
  on task_comment_reactions for delete
  using (user_id = auth.uid());
