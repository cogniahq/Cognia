-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_user_id_fkey";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "actor_email" TEXT,
ADD COLUMN     "organization_id" UUID,
ADD COLUMN     "target_resource_id" TEXT,
ADD COLUMN     "target_resource_type" TEXT,
ADD COLUMN     "target_user_id" UUID,
ALTER COLUMN "user_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
