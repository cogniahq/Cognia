-- AlterTable
ALTER TABLE "organization_members" ADD COLUMN     "deactivated_at" TIMESTAMP(3),
ADD COLUMN     "deactivation_reason" TEXT;
