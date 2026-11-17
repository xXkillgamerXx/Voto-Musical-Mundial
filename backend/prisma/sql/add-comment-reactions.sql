ALTER TABLE "comments"
  ADD COLUMN IF NOT EXISTS "reactions_count" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "comment_reactions" (
  "id" BIGSERIAL PRIMARY KEY,
  "comment_id" BIGINT NOT NULL,
  "user_id" BIGINT NOT NULL,
  "reaction" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_reactions_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comment_reactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "comment_reactions_comment_id_user_id_key"
  ON "comment_reactions"("comment_id", "user_id");
CREATE INDEX IF NOT EXISTS "comment_reactions_comment_id_reaction_idx"
  ON "comment_reactions"("comment_id", "reaction");
CREATE INDEX IF NOT EXISTS "comment_reactions_user_id_idx"
  ON "comment_reactions"("user_id");
CREATE INDEX IF NOT EXISTS "comments_poll_id_reactions_count_created_at_idx"
  ON "comments"("poll_id", "reactions_count", "created_at");
