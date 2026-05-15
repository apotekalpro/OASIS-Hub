-- Storage bucket for chat/message attachments
-- Run this in Supabase Dashboard > SQL Editor, or via CLI
-- The bucket itself must be created in Dashboard > Storage > New Bucket: "chat-attachments" (public)

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat-attachments: authenticated users can upload" ON storage.objects;
CREATE POLICY "chat-attachments: authenticated users can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat-attachments: public read" ON storage.objects;
CREATE POLICY "chat-attachments: public read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "chat-attachments: uploader can delete" ON storage.objects;
CREATE POLICY "chat-attachments: uploader can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND owner = auth.uid());
