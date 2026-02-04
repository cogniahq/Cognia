-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('PERSONAL', 'ORGANIZATION');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "account_type" "AccountType" NOT NULL DEFAULT 'PERSONAL';
