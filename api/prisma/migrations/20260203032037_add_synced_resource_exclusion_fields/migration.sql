-- AlterTable
ALTER TABLE "synced_resources" ADD COLUMN     "excluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "excluded_at" TIMESTAMP(3),
ADD COLUMN     "excluded_by" UUID;

-- CreateIndex
CREATE INDEX "synced_resources_excluded_idx" ON "synced_resources"("excluded");
