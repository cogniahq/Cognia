-- Remove the briefings subsystem entirely.
-- Drops the IntelligenceBriefing model, the NotificationPreferences model
-- (whose only fields were briefing-specific), and the BriefingType enum.

-- DropForeignKey
ALTER TABLE "intelligence_briefings" DROP CONSTRAINT IF EXISTS "intelligence_briefings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "intelligence_briefings" DROP CONSTRAINT IF EXISTS "intelligence_briefings_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT IF EXISTS "notification_preferences_user_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "intelligence_briefings";

-- DropTable
DROP TABLE IF EXISTS "notification_preferences";

-- DropEnum
DROP TYPE IF EXISTS "BriefingType";
