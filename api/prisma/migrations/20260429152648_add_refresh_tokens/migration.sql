/*
  Warnings:

  - You are about to drop the column `space_id` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the `organization_spaces` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_space_id_fkey";

-- DropForeignKey
ALTER TABLE "organization_spaces" DROP CONSTRAINT "organization_spaces_created_by_fkey";

-- DropForeignKey
ALTER TABLE "organization_spaces" DROP CONSTRAINT "organization_spaces_organization_id_fkey";

-- DropIndex
DROP INDEX "documents_organization_id_space_id_idx";

-- DropIndex
DROP INDEX "documents_space_id_idx";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "space_id";

-- DropTable
DROP TABLE "organization_spaces";

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "parent_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
