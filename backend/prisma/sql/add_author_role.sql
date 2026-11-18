-- Add news-author role (run once against vote_db / production Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'author'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'author';
  END IF;
END $$;
