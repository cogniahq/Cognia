-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "workspace_id" UUID;

-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_tags" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" UUID,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_tags_on_memories" (
    "memory_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_tags_on_memories_pkey" PRIMARY KEY ("memory_id","tag_id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "alert_enabled" BOOLEAN NOT NULL DEFAULT false,
    "alert_frequency" TEXT NOT NULL DEFAULT 'daily',
    "last_alerted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspaces_organization_id_idx" ON "workspaces"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_organization_id_slug_key" ON "workspaces"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "memory_tags_organization_id_idx" ON "memory_tags"("organization_id");

-- CreateIndex
CREATE INDEX "memory_tags_user_id_idx" ON "memory_tags"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_tags_organization_id_name_key" ON "memory_tags"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "memory_tags_user_id_name_key" ON "memory_tags"("user_id", "name");

-- CreateIndex
CREATE INDEX "memory_tags_on_memories_memory_id_idx" ON "memory_tags_on_memories"("memory_id");

-- CreateIndex
CREATE INDEX "memory_tags_on_memories_tag_id_idx" ON "memory_tags_on_memories"("tag_id");

-- CreateIndex
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches"("user_id");

-- CreateIndex
CREATE INDEX "saved_searches_organization_id_idx" ON "saved_searches"("organization_id");

-- CreateIndex
CREATE INDEX "saved_searches_alert_enabled_alert_frequency_idx" ON "saved_searches"("alert_enabled", "alert_frequency");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tags" ADD CONSTRAINT "memory_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tags" ADD CONSTRAINT "memory_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tags_on_memories" ADD CONSTRAINT "memory_tags_on_memories_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_tags_on_memories" ADD CONSTRAINT "memory_tags_on_memories_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "memory_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
