-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'DEMO';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "demo_dismissed_at" TIMESTAMP(3),
ADD COLUMN     "tour_completed_at" TIMESTAMP(3);
