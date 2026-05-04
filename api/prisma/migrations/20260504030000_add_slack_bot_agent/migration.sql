CREATE TABLE "slack_bot_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "slack_channel_id" TEXT NOT NULL,
    "slack_thread_ts" TEXT,
    "slack_event_ts" TEXT NOT NULL,
    "slack_event_id" TEXT NOT NULL,
    "slack_user_id" TEXT,
    "actor_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prompt" TEXT NOT NULL,
    "response" TEXT,
    "error" TEXT,
    "tool_trace" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "slack_bot_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "slack_bot_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "action_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "tool_arguments" JSONB NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "slack_channel_id" TEXT NOT NULL,
    "slack_user_id" TEXT,
    "slack_message_ts" TEXT,
    "slack_thread_ts" TEXT,
    "requester_user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_by_slack_user_id" TEXT,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMP(3),
    "execution_result" JSONB,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_bot_approvals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "slack_bot_runs_slack_team_id_slack_event_id_key" ON "slack_bot_runs"("slack_team_id", "slack_event_id");
CREATE INDEX "slack_bot_runs_organization_id_created_at_idx" ON "slack_bot_runs"("organization_id", "created_at");
CREATE INDEX "slack_bot_runs_integration_id_idx" ON "slack_bot_runs"("integration_id");
CREATE INDEX "slack_bot_runs_slack_team_id_slack_channel_id_slack_event_ts_idx" ON "slack_bot_runs"("slack_team_id", "slack_channel_id", "slack_event_ts");

CREATE UNIQUE INDEX "slack_bot_approvals_action_id_key" ON "slack_bot_approvals"("action_id");
CREATE INDEX "slack_bot_approvals_organization_id_created_at_idx" ON "slack_bot_approvals"("organization_id", "created_at");
CREATE INDEX "slack_bot_approvals_run_id_idx" ON "slack_bot_approvals"("run_id");
CREATE INDEX "slack_bot_approvals_status_expires_at_idx" ON "slack_bot_approvals"("status", "expires_at");
CREATE INDEX "slack_bot_approvals_slack_team_id_slack_channel_id_idx" ON "slack_bot_approvals"("slack_team_id", "slack_channel_id");
