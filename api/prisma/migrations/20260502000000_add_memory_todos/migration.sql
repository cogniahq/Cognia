-- Add MemoryTodo model: extracted action items / upcoming events from
-- captured memories, surfaced in the org "Upcoming" view and one-click
-- pushable to Google Calendar.
--
-- prisma migrate dev was unavailable in this environment (Prisma 7 CLI
-- rejects the inline `datasource.url` declaration in schema.prisma), so
-- this migration is hand-written. Apply via `prisma migrate deploy` or
-- by running this file directly against the dev DB.

-- CreateEnum
CREATE TYPE "TodoStatus" AS ENUM ('PENDING', 'DONE', 'SNOOZED', 'DISMISSED');

-- CreateTable
CREATE TABLE "memory_todos" (
    "id" UUID NOT NULL,
    "memory_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source_excerpt" TEXT,
    "due_at" TIMESTAMP(3),
    "status" "TodoStatus" NOT NULL DEFAULT 'PENDING',
    "calendar_event_id" TEXT,
    "calendar_provider" TEXT,
    "snoozed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "memory_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memory_todos_organization_id_status_idx" ON "memory_todos"("organization_id", "status");

-- CreateIndex
CREATE INDEX "memory_todos_user_id_status_idx" ON "memory_todos"("user_id", "status");

-- CreateIndex
CREATE INDEX "memory_todos_memory_id_idx" ON "memory_todos"("memory_id");

-- CreateIndex
CREATE INDEX "memory_todos_due_at_idx" ON "memory_todos"("due_at");

-- AddForeignKey
ALTER TABLE "memory_todos" ADD CONSTRAINT "memory_todos_memory_id_fkey" FOREIGN KEY ("memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_todos" ADD CONSTRAINT "memory_todos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_todos" ADD CONSTRAINT "memory_todos_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
