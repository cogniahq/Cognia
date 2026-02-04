-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "audit_retention" TEXT NOT NULL DEFAULT '90d',
ADD COLUMN     "billing_address" JSONB,
ADD COLUMN     "billing_email" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "data_residency" TEXT NOT NULL DEFAULT 'auto',
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "ip_allowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "password_policy" TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN     "plan" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "postal_code" TEXT,
ADD COLUMN     "require_2fa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "security_prompt_shown" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session_timeout" TEXT NOT NULL DEFAULT '7d',
ADD COLUMN     "setup_completed_at" TIMESTAMP(3),
ADD COLUMN     "setup_completed_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "setup_started_at" TIMESTAMP(3),
ADD COLUMN     "sso_config" JSONB,
ADD COLUMN     "sso_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "state_region" TEXT,
ADD COLUMN     "street_address" TEXT,
ADD COLUMN     "team_size" TEXT,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "vat_tax_id" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateTable
CREATE TABLE "organization_invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'VIEWER',
    "invited_by" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_integrations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "config" JSONB,
    "connected_by" UUID NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_token_key" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_token_idx" ON "organization_invitations"("token");

-- CreateIndex
CREATE INDEX "organization_invitations_organization_id_idx" ON "organization_invitations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_invitations_organization_id_email_key" ON "organization_invitations"("organization_id", "email");

-- CreateIndex
CREATE INDEX "organization_integrations_organization_id_idx" ON "organization_integrations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_integrations_organization_id_provider_key" ON "organization_integrations"("organization_id", "provider");

-- AddForeignKey
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
