CREATE TYPE "NewsPostStatus" AS ENUM ('draft', 'publish', 'scheduled', 'trash');

CREATE TABLE "news_categories" (
  "id" BIGSERIAL PRIMARY KEY,
  "wp_id" INTEGER UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "parent_id" BIGINT,
  "nav" BOOLEAN NOT NULL DEFAULT false,
  "order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "news_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "news_categories"("id") ON DELETE SET NULL
);

CREATE TABLE "news_posts" (
  "id" BIGSERIAL PRIMARY KEY,
  "wp_id" INTEGER UNIQUE,
  "slug" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL DEFAULT '',
  "content" TEXT NOT NULL DEFAULT '',
  "cover_url" TEXT,
  "status" "NewsPostStatus" NOT NULL DEFAULT 'draft',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "comment_count" INTEGER NOT NULL DEFAULT 0,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "author_name" TEXT NOT NULL DEFAULT 'Redacción',
  "author_user_id" BIGINT,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "news_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE TABLE "news_post_categories" (
  "post_id" BIGINT NOT NULL,
  "category_id" BIGINT NOT NULL,
  CONSTRAINT "news_post_categories_pkey" PRIMARY KEY ("post_id", "category_id"),
  CONSTRAINT "news_post_categories_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "news_posts"("id") ON DELETE CASCADE,
  CONSTRAINT "news_post_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_categories"("id") ON DELETE CASCADE
);

CREATE INDEX "news_categories_nav_order_idx" ON "news_categories"("nav", "order");
CREATE INDEX "news_posts_status_published_at_idx" ON "news_posts"("status", "published_at");
CREATE INDEX "news_posts_featured_published_at_idx" ON "news_posts"("featured", "published_at");
CREATE INDEX "news_posts_status_view_count_idx" ON "news_posts"("status", "view_count");
CREATE INDEX "news_post_categories_category_id_post_id_idx" ON "news_post_categories"("category_id", "post_id");
