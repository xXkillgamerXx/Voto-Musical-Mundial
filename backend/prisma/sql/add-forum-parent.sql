ALTER TABLE "forum_categories"
  ADD COLUMN IF NOT EXISTS "parent_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'forum_categories_parent_id_fkey'
  ) THEN
    ALTER TABLE "forum_categories"
      ADD CONSTRAINT "forum_categories_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "forum_categories"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "forum_categories_parent_id_sort_order_idx"
  ON "forum_categories"("parent_id", "sort_order");
