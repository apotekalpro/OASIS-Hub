-- Increase file size limit for task-attachments and chat-attachments buckets to 50 MB
update storage.buckets
set file_size_limit = 52428800  -- 50 MB
where id in ('task-attachments', 'chat-attachments');
