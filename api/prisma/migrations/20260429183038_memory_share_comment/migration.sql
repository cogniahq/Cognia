-- CreateEnum
CREATE TYPE "SharePermission" AS ENUM ('READ', 'COMMENT');

-- CreateEnum
CREATE TYPE "ShareRecipientType" AS ENUM ('USER', 'ORG', 'LINK');

-- CreateTable
CREATE TABLE "memory_shares" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "sharer_user_id" UUID NOT NULL,
    "recipient_type" "ShareRecipientType" NOT NULL,
    "recipient_user_id" UUID,
    "recipient_org_id" UUID,
    "link_token" TEXT,
    "permission" "SharePermission" NOT NULL DEFAULT 'READ',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "memory_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_comments" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "parent_id" UUID,
    "body_md" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "memory_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "memory_shares_link_token_key" ON "memory_shares"("link_token");

-- CreateIndex
CREATE INDEX "memory_shares_memory_id_idx" ON "memory_shares"("memory_id");

-- CreateIndex
CREATE INDEX "memory_shares_recipient_user_id_idx" ON "memory_shares"("recipient_user_id");

-- CreateIndex
CREATE INDEX "memory_shares_recipient_org_id_idx" ON "memory_shares"("recipient_org_id");

-- CreateIndex
CREATE INDEX "memory_comments_memory_id_idx" ON "memory_comments"("memory_id");

-- CreateIndex
CREATE INDEX "memory_comments_parent_id_idx" ON "memory_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "memory_shares" ADD CONSTRAINT "memory_shares_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_shares" ADD CONSTRAINT "memory_shares_sharer_user_id_fkey" FOREIGN KEY ("sharer_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_shares" ADD CONSTRAINT "memory_shares_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_shares" ADD CONSTRAINT "memory_shares_recipient_org_id_fkey" FOREIGN KEY ("recipient_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_comments" ADD CONSTRAINT "memory_comments_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_comments" ADD CONSTRAINT "memory_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_comments" ADD CONSTRAINT "memory_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "memory_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
