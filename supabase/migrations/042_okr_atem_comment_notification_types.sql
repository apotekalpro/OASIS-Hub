-- Extend notification_type enum with OKR and ATEM comment/mention types
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'okr_commented';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'okr_mention';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'atem_commented';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'atem_mention';
