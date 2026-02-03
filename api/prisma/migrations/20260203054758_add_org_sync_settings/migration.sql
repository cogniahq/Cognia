-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "custom_sync_interval_min" INTEGER,
ADD COLUMN     "default_sync_frequency" "SyncFrequency" NOT NULL DEFAULT 'HOURLY';
