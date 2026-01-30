/*
  Warnings:

  - The `relation_type` column on the `memory_relations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('semantic', 'topical', 'temporal');

-- AlterTable
ALTER TABLE "memory_relations" DROP COLUMN "relation_type",
ADD COLUMN     "relation_type" "RelationType" NOT NULL DEFAULT 'semantic';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "memories_user_id_importance_score_idx" ON "memories"("user_id", "importance_score");

-- CreateIndex
CREATE INDEX "memories_user_id_memory_type_idx" ON "memories"("user_id", "memory_type");

-- CreateIndex
CREATE INDEX "memories_last_accessed_idx" ON "memories"("last_accessed");

-- CreateIndex
CREATE INDEX "memory_relations_relation_type_idx" ON "memory_relations"("relation_type");
