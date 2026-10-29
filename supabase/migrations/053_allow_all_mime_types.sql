-- Remove MIME type restrictions so all file types can be uploaded
update storage.buckets
set allowed_mime_types = null
where id in ('task-attachments', 'chat-attachments', 'okr-attachments', 'atem-attachments');
