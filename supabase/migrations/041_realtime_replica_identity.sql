-- Required for Supabase postgres_changes filtered subscriptions.
-- Without REPLICA IDENTITY FULL, filter clauses on non-PK columns
-- (e.g. user_id=eq.<id>) cannot be evaluated and events are silently dropped.

ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE messages     REPLICA IDENTITY FULL;

-- Ensure both tables are in the realtime publication (safe if already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END;
$$;
