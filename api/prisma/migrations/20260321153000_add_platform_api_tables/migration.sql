-- CreateEnum
CREATE TYPE "PlatformUploadStatus" AS ENUM (
    'PENDING',
    'UPLOADING',
    'UPLOADED',
    'COMPLETED',
    'FAILED',
    'EXPIRED'
);

-- CreateTable
CREATE TABLE "trusted_platform_apps" (
    "id" UUID NOT NULL,
    "app_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusted_platform_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_tenant_links" (
    "id" UUID NOT NULL,
    "trusted_app_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_tenant_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_user_links" (
    "id" UUID NOT NULL,
    "trusted_app_id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_user_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_upload_sessions" (
    "id" UUID NOT NULL,
    "trusted_app_id" UUID NOT NULL,
    "platform_tenant_link_id" UUID NOT NULL,
    "platform_user_link_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "metadata" JSONB,
    "status" "PlatformUploadStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusted_platform_apps_app_id_key" ON "trusted_platform_apps"("app_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_tenant_links_trusted_app_id_external_id_key" ON "platform_tenant_links"("trusted_app_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_tenant_links_trusted_app_id_organization_id_key" ON "platform_tenant_links"("trusted_app_id", "organization_id");

-- CreateIndex
CREATE INDEX "platform_tenant_links_trusted_app_id_idx" ON "platform_tenant_links"("trusted_app_id");

-- CreateIndex
CREATE INDEX "platform_tenant_links_organization_id_idx" ON "platform_tenant_links"("organization_id");

-- CreateIndex
CREATE INDEX "platform_tenant_links_active_idx" ON "platform_tenant_links"("active");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_links_trusted_app_id_external_id_key" ON "platform_user_links"("trusted_app_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_user_links_trusted_app_id_user_id_key" ON "platform_user_links"("trusted_app_id", "user_id");

-- CreateIndex
CREATE INDEX "platform_user_links_trusted_app_id_idx" ON "platform_user_links"("trusted_app_id");

-- CreateIndex
CREATE INDEX "platform_user_links_user_id_idx" ON "platform_user_links"("user_id");

-- CreateIndex
CREATE INDEX "platform_user_links_active_idx" ON "platform_user_links"("active");

-- CreateIndex
CREATE UNIQUE INDEX "platform_upload_sessions_storage_key_key" ON "platform_upload_sessions"("storage_key");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_trusted_app_id_idx" ON "platform_upload_sessions"("trusted_app_id");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_platform_tenant_link_id_idx" ON "platform_upload_sessions"("platform_tenant_link_id");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_platform_user_link_id_idx" ON "platform_upload_sessions"("platform_user_link_id");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_organization_id_idx" ON "platform_upload_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_uploader_id_idx" ON "platform_upload_sessions"("uploader_id");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_status_idx" ON "platform_upload_sessions"("status");

-- CreateIndex
CREATE INDEX "platform_upload_sessions_expires_at_idx" ON "platform_upload_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "platform_tenant_links" ADD CONSTRAINT "platform_tenant_links_trusted_app_id_fkey" FOREIGN KEY ("trusted_app_id") REFERENCES "trusted_platform_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_tenant_links" ADD CONSTRAINT "platform_tenant_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_links" ADD CONSTRAINT "platform_user_links_trusted_app_id_fkey" FOREIGN KEY ("trusted_app_id") REFERENCES "trusted_platform_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_user_links" ADD CONSTRAINT "platform_user_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_upload_sessions" ADD CONSTRAINT "platform_upload_sessions_trusted_app_id_fkey" FOREIGN KEY ("trusted_app_id") REFERENCES "trusted_platform_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_upload_sessions" ADD CONSTRAINT "platform_upload_sessions_platform_tenant_link_id_fkey" FOREIGN KEY ("platform_tenant_link_id") REFERENCES "platform_tenant_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_upload_sessions" ADD CONSTRAINT "platform_upload_sessions_platform_user_link_id_fkey" FOREIGN KEY ("platform_user_link_id") REFERENCES "platform_user_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_upload_sessions" ADD CONSTRAINT "platform_upload_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_upload_sessions" ADD CONSTRAINT "platform_upload_sessions_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
