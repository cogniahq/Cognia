-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "sso_config",
ADD COLUMN     "sso_attribute_email" TEXT DEFAULT 'email',
ADD COLUMN     "sso_attribute_groups" TEXT DEFAULT 'groups',
ADD COLUMN     "sso_email_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sso_enforced" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sso_idp_cert" TEXT,
ADD COLUMN     "sso_idp_entity_id" TEXT,
ADD COLUMN     "sso_idp_oidc_client_id" TEXT,
ADD COLUMN     "sso_idp_oidc_client_secret" TEXT,
ADD COLUMN     "sso_idp_oidc_issuer" TEXT,
ADD COLUMN     "sso_idp_sso_url" TEXT,
ADD COLUMN     "sso_provider" TEXT,
ADD COLUMN     "sso_role_mapping" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scim_access_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "name" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "scim_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_subject_key" ON "oauth_identities"("provider", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_verification_tokens_purpose_idx" ON "email_verification_tokens"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "scim_access_tokens_token_hash_key" ON "scim_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "scim_access_tokens_organization_id_idx" ON "scim_access_tokens"("organization_id");

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scim_access_tokens" ADD CONSTRAINT "scim_access_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
