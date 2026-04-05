-- CreateTable
CREATE TABLE "organization_spaces" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_spaces_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "space_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "organization_spaces_organization_id_slug_key" ON "organization_spaces"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "organization_spaces_organization_id_created_at_idx" ON "organization_spaces"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_space_id_idx" ON "documents"("space_id");

-- CreateIndex
CREATE INDEX "documents_organization_id_space_id_idx" ON "documents"("organization_id", "space_id");

-- AddForeignKey
ALTER TABLE "organization_spaces" ADD CONSTRAINT "organization_spaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_spaces" ADD CONSTRAINT "organization_spaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "organization_spaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;
