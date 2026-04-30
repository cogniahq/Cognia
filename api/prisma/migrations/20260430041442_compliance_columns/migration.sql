-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "legal_hold_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "consent" JSONB,
ADD COLUMN     "deletion_scheduled_at" TIMESTAMP(3),
ADD COLUMN     "legal_hold_until" TIMESTAMP(3);
