-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "llm_config" JSONB,
ADD COLUMN     "llm_key_encrypted" TEXT,
ADD COLUMN     "llm_provider" TEXT;
