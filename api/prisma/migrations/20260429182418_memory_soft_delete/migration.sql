-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "memories_user_id_deleted_at_idx" ON "memories"("user_id", "deleted_at");
