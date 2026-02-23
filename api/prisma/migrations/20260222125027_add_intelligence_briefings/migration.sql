-- CreateEnum
CREATE TYPE "BriefingType" AS ENUM ('DAILY_DIGEST', 'WEEKLY_SYNTHESIS', 'TREND_ALERT', 'TEAM_REPORT');

-- CreateTable
CREATE TABLE "intelligence_briefings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "briefing_type" "BriefingType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "wow_facts" JSONB,
    "knowledge_gaps" JSONB,
    "connections" JSONB,
    "expert_updates" JSONB,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intelligence_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "daily_digest" BOOLEAN NOT NULL DEFAULT true,
    "weekly_synthesis" BOOLEAN NOT NULL DEFAULT true,
    "trend_alerts" BOOLEAN NOT NULL DEFAULT true,
    "team_reports" BOOLEAN NOT NULL DEFAULT true,
    "digest_hour" INTEGER NOT NULL DEFAULT 18,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intelligence_briefings_user_id_briefing_type_period_start_idx" ON "intelligence_briefings"("user_id", "briefing_type", "period_start");

-- CreateIndex
CREATE INDEX "intelligence_briefings_organization_id_briefing_type_period_idx" ON "intelligence_briefings"("organization_id", "briefing_type", "period_start");

-- CreateIndex
CREATE INDEX "intelligence_briefings_user_id_created_at_idx" ON "intelligence_briefings"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "intelligence_briefings" ADD CONSTRAINT "intelligence_briefings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_briefings" ADD CONSTRAINT "intelligence_briefings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
