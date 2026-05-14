-- Storage bucket for task comment attachments
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-attachments',
  'task-attachments',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

-- Storage RLS policies
create policy "task-attachments: authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'task-attachments');

create policy "task-attachments: public can read"
  on storage.objects for select to public
  using (bucket_id = 'task-attachments');

create policy "task-attachments: owners can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'task-attachments' and owner = auth.uid());

-- Add attachments column to task_comments
alter table task_comments
  add column if not exists attachments jsonb default null;
