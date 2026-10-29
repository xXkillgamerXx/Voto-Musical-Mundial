CREATE TABLE IF NOT EXISTS "forum_categories" (
  "id" BIGSERIAL PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "name_es" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "blurb_es" TEXT NOT NULL,
  "blurb_en" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT 'note',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_vip" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "forum_topics" (
  "id" BIGSERIAL PRIMARY KEY,
  "category_id" BIGINT NOT NULL,
  "author_id" BIGINT NOT NULL,
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "reply_count" INTEGER NOT NULL DEFAULT 0,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "last_post_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_poster_id" BIGINT,
  "closed_at" TIMESTAMP(3),
  "pinned_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_topics_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "forum_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "forum_topics_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "forum_topics_last_poster_id_fkey" FOREIGN KEY ("last_poster_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "forum_topics_category_id_slug_key" ON "forum_topics"("category_id", "slug");
CREATE INDEX IF NOT EXISTS "forum_topics_category_id_last_post_at_idx" ON "forum_topics"("category_id", "last_post_at");
CREATE INDEX IF NOT EXISTS "forum_topics_deleted_at_last_post_at_idx" ON "forum_topics"("deleted_at", "last_post_at");
CREATE INDEX IF NOT EXISTS "forum_topics_deleted_at_created_at_idx" ON "forum_topics"("deleted_at", "created_at");
CREATE INDEX IF NOT EXISTS "forum_topics_author_id_created_at_idx" ON "forum_topics"("author_id", "created_at");

CREATE TABLE IF NOT EXISTS "forum_posts" (
  "id" BIGSERIAL PRIMARY KEY,
  "topic_id" BIGINT NOT NULL,
  "author_id" BIGINT NOT NULL,
  "body" TEXT NOT NULL,
  "images" JSONB NOT NULL DEFAULT '[]',
  "position" INTEGER NOT NULL,
  "reply_to_post_id" BIGINT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forum_posts_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "forum_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "forum_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "forum_posts_reply_to_post_id_fkey" FOREIGN KEY ("reply_to_post_id") REFERENCES "forum_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "forum_posts_topic_id_position_key" ON "forum_posts"("topic_id", "position");
CREATE INDEX IF NOT EXISTS "forum_posts_topic_id_position_idx" ON "forum_posts"("topic_id", "position");
CREATE INDEX IF NOT EXISTS "forum_posts_author_id_created_at_idx" ON "forum_posts"("author_id", "created_at");

INSERT INTO "forum_categories" ("slug", "name_es", "name_en", "blurb_es", "blurb_en", "icon", "sort_order", "is_vip")
VALUES
  ('pop', 'POP', 'POP', 'Pop, artistas y las últimas novedades.', 'Pop music, artists and the latest updates.', 'note', 1, false),
  ('kpop', 'KPOP', 'KPOP', 'Grupos, comebacks y fandom.', 'K-pop groups, comebacks and fandom.', 'music', 2, false),
  ('hall-of-fame', 'HALL OF FAME', 'HALL OF FAME', 'Leyendas y los momentos que no se olvidan.', 'Celebrate the legends and unforgettable moments.', 'artist', 3, false),
  ('vip', 'VIP & PREMIUM', 'VIP & PREMIUM', 'Espacio exclusivo para miembros FAN.', 'Exclusive space for FAN members.', 'mic', 4, true),
  ('spaces', 'SPACES', 'SPACES', 'Clubs de fans y espacios de cada fandom.', 'Fan clubs and a space for every fandom.', 'pop', 5, false)
ON CONFLICT ("slug") DO NOTHING;
