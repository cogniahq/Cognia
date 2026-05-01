-- CreateTable
CREATE TABLE "mesh_snapshots" (
    "id" UUID NOT NULL,
    "scope_type" TEXT NOT NULL,
    "scope_id" UUID NOT NULL,
    "node_count" INTEGER NOT NULL,
    "edge_count" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mesh_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mesh_snapshots_scope_type_scope_id_key"
  ON "mesh_snapshots"("scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "mesh_snapshots_scope_type_scope_id_computed_at_idx"
  ON "mesh_snapshots"("scope_type", "scope_id", "computed_at");
