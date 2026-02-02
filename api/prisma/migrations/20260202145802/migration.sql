/*
  Warnings:

  - Added the required column `updated_at` to the `organization_integrations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR', 'RATE_LIMITED', 'TOKEN_EXPIRED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "StorageStrategy" AS ENUM ('METADATA_ONLY', 'FULL_CONTENT');

-- CreateEnum
CREATE TYPE "SyncFrequency" AS ENUM ('REALTIME', 'FIFTEEN_MIN', 'HOURLY', 'DAILY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "organization_integrations" ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "last_sync_at" TIMESTAMP(3),
ADD COLUMN     "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "storage_strategy" "StorageStrategy" NOT NULL DEFAULT 'FULL_CONTENT',
ADD COLUMN     "sync_frequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN     "token_expires_at" TIMESTAMP(3),
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "webhook_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "two_factor_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "two_factor_secret" TEXT;

-- CreateTable
CREATE TABLE "user_integrations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "config" JSONB,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "storage_strategy" "StorageStrategy" NOT NULL DEFAULT 'FULL_CONTENT',
    "sync_frequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY',
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "webhook_id" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_registry" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "allowed_plans" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_registry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_sync_jobs" (
    "id" UUID NOT NULL,
    "integration_id" TEXT NOT NULL,
    "integration_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "resources_found" INTEGER NOT NULL DEFAULT 0,
    "resources_synced" INTEGER NOT NULL DEFAULT 0,
    "resources_failed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "error_details" JSONB,
    "cursor" TEXT,

    CONSTRAINT "integration_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synced_resources" (
    "id" UUID NOT NULL,
    "integration_id" TEXT NOT NULL,
    "integration_type" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "memory_id" UUID,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synced_resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_integrations_user_id_idx" ON "user_integrations"("user_id");

-- CreateIndex
CREATE INDEX "user_integrations_status_idx" ON "user_integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_integrations_user_id_provider_key" ON "user_integrations"("user_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "integration_registry_provider_key" ON "integration_registry"("provider");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_integration_id_integration_type_idx" ON "integration_sync_jobs"("integration_id", "integration_type");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_status_idx" ON "integration_sync_jobs"("status");

-- CreateIndex
CREATE INDEX "integration_sync_jobs_started_at_idx" ON "integration_sync_jobs"("started_at");

-- CreateIndex
CREATE INDEX "synced_resources_integration_id_integration_type_idx" ON "synced_resources"("integration_id", "integration_type");

-- CreateIndex
CREATE INDEX "synced_resources_memory_id_idx" ON "synced_resources"("memory_id");

-- CreateIndex
CREATE UNIQUE INDEX "synced_resources_integration_id_integration_type_external_i_key" ON "synced_resources"("integration_id", "integration_type", "external_id");

-- CreateIndex
CREATE INDEX "organization_integrations_status_idx" ON "organization_integrations"("status");

-- AddForeignKey
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
