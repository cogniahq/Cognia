-- CreateTable
CREATE TABLE "developer_apps" (
    "id" UUID NOT NULL,
    "developer_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "mesh_namespace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "developer_apps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developer_apps_mesh_namespace_id_key" ON "developer_apps"("mesh_namespace_id");

-- CreateIndex
CREATE INDEX "developer_apps_developer_id_idx" ON "developer_apps"("developer_id");

-- CreateIndex
CREATE INDEX "developer_apps_mesh_namespace_id_idx" ON "developer_apps"("mesh_namespace_id");

-- AddForeignKey
ALTER TABLE "developer_apps" ADD CONSTRAINT "developer_apps_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ensure api_keys table exists with legacy columns for migration
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "memory_isolation" BOOLEAN NOT NULL DEFAULT FALSE,
    "rate_limit" INTEGER,
    "rate_limit_window" INTEGER,
    "expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "last_used_at" TIMESTAMP(3),
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- Migrate existing API keys to developer apps
-- Step 1: Add nullable developer_app_id and last_four columns
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "developer_app_id" UUID;
ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "last_four" TEXT;

-- Step 2: Create default developer apps for users with API keys
INSERT INTO "developer_apps" ("id", "developer_id", "name", "mesh_namespace_id", "created_at", "updated_at")
SELECT DISTINCT ON (ak."user_id")
    gen_random_uuid() as "id",
    ak."user_id" as "developer_id",
    'Default App' as "name",
    gen_random_uuid()::TEXT as "mesh_namespace_id",
    NOW() as "created_at",
    NOW() as "updated_at"
FROM "api_keys" ak
WHERE ak."user_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "developer_apps" da WHERE da."developer_id" = ak."user_id"
  );

-- Step 3: Update API keys to reference their developer app
-- Extract last 4 characters from key_prefix for last_four
UPDATE "api_keys" ak
SET 
    "developer_app_id" = da."id",
    "last_four" = CASE 
        WHEN LENGTH(ak."key_prefix") >= 4 THEN RIGHT(ak."key_prefix", 4)
        ELSE ak."key_prefix"
    END
FROM "developer_apps" da
WHERE ak."user_id" = da."developer_id"
  AND ak."developer_app_id" IS NULL;

-- Step 4: Make developer_app_id NOT NULL and remove user_id
ALTER TABLE "api_keys" ALTER COLUMN "developer_app_id" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "last_four" SET NOT NULL;
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_user_id_fkey";
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "memory_isolation";

-- Step 5: Add foreign key for developer_app_id
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_developer_app_id_fkey" FOREIGN KEY ("developer_app_id") REFERENCES "developer_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Update indexes
DROP INDEX IF EXISTS "api_keys_user_id_idx";
CREATE INDEX IF NOT EXISTS "api_keys_developer_app_id_idx" ON "api_keys"("developer_app_id");
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_is_active_idx" ON "api_keys"("is_active");
CREATE INDEX IF NOT EXISTS "api_keys_expires_at_idx" ON "api_keys"("expires_at");

-- Ensure memories has api_key_id column and constraint
ALTER TABLE "memories" ADD COLUMN IF NOT EXISTS "api_key_id" UUID;
ALTER TABLE "memories" DROP CONSTRAINT IF EXISTS "memories_api_key_id_fkey";
ALTER TABLE "memories" ADD CONSTRAINT "memories_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "memories_user_id_api_key_id_idx" ON "memories"("user_id", "api_key_id");