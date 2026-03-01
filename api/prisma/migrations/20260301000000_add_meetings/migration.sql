-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('JOINING', 'IN_MEETING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "meeting_url" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "bot_session_id" TEXT,
    "calendar_event_id" TEXT,
    "status" "MeetingStatus" NOT NULL DEFAULT 'JOINING',
    "title" TEXT,
    "raw_transcript" JSONB,
    "summary" TEXT,
    "action_items" JSONB,
    "topics" JSONB,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_user_id_idx" ON "meetings"("user_id");

-- CreateIndex
CREATE INDEX "meetings_organization_id_idx" ON "meetings"("organization_id");

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- CreateIndex
CREATE INDEX "meetings_calendar_event_id_idx" ON "meetings"("calendar_event_id");

-- CreateIndex
CREATE INDEX "meetings_user_id_created_at_idx" ON "meetings"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
