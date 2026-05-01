-- Idempotent on fresh DBs: the billing tables are created in a later migration
-- (20260430034015_billing). On a fresh database, this whole file is a no-op.
-- On databases that already had Stripe billing, it migrates them to Razorpay.

-- DropIndex
DROP INDEX IF EXISTS "billing_events_stripe_event_id_key";
DROP INDEX IF EXISTS "invoices_stripe_invoice_id_key";
DROP INDEX IF EXISTS "subscriptions_stripe_customer_id_key";
DROP INDEX IF EXISTS "subscriptions_stripe_subscription_id_key";

-- AlterTable: billing_events
ALTER TABLE IF EXISTS "billing_events" DROP COLUMN IF EXISTS "stripe_event_id";
ALTER TABLE IF EXISTS "billing_events" ADD COLUMN IF NOT EXISTS "razorpay_event_id" TEXT NOT NULL;

-- AlterTable: invoices
ALTER TABLE IF EXISTS "invoices" DROP COLUMN IF EXISTS "amount_due_cents";
ALTER TABLE IF EXISTS "invoices" DROP COLUMN IF EXISTS "amount_paid_cents";
ALTER TABLE IF EXISTS "invoices" DROP COLUMN IF EXISTS "stripe_invoice_id";
ALTER TABLE IF EXISTS "invoices" ADD COLUMN IF NOT EXISTS "amount_due_paise" INTEGER NOT NULL;
ALTER TABLE IF EXISTS "invoices" ADD COLUMN IF NOT EXISTS "amount_paid_paise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS "invoices" ADD COLUMN IF NOT EXISTS "razorpay_invoice_id" TEXT NOT NULL;
ALTER TABLE IF EXISTS "invoices" ADD COLUMN IF NOT EXISTS "razorpay_payment_id" TEXT;

-- AlterTable: subscriptions
ALTER TABLE IF EXISTS "subscriptions" DROP COLUMN IF EXISTS "stripe_customer_id";
ALTER TABLE IF EXISTS "subscriptions" DROP COLUMN IF EXISTS "stripe_price_id";
ALTER TABLE IF EXISTS "subscriptions" DROP COLUMN IF EXISTS "stripe_subscription_id";
ALTER TABLE IF EXISTS "subscriptions" ADD COLUMN IF NOT EXISTS "razorpay_customer_id" TEXT;
ALTER TABLE IF EXISTS "subscriptions" ADD COLUMN IF NOT EXISTS "razorpay_plan_id" TEXT;
ALTER TABLE IF EXISTS "subscriptions" ADD COLUMN IF NOT EXISTS "razorpay_subscription_id" TEXT;
ALTER TABLE IF EXISTS "subscriptions" ADD COLUMN IF NOT EXISTS "short_url" TEXT;

-- AlterTable: usage_records
ALTER TABLE IF EXISTS "usage_records" DROP COLUMN IF EXISTS "reported_to_stripe_at";
ALTER TABLE IF EXISTS "usage_records" ADD COLUMN IF NOT EXISTS "reported_to_razorpay_at" TIMESTAMP(3);

-- ALTER COLUMN defaults — wrap in DO blocks so they no-op when tables don't exist
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'currency') THEN
    EXECUTE 'ALTER TABLE "invoices" ALTER COLUMN "currency" SET DEFAULT ''INR''';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'status') THEN
    EXECUTE 'ALTER TABLE "subscriptions" ALTER COLUMN "status" SET DEFAULT ''created''';
  END IF;
END $$;

-- CreateIndex (only if the underlying columns exist)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'billing_events' AND column_name = 'razorpay_event_id') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "billing_events_razorpay_event_id_key" ON "billing_events"("razorpay_event_id")';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'razorpay_invoice_id') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "invoices_razorpay_invoice_id_key" ON "invoices"("razorpay_invoice_id")';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'razorpay_customer_id') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpay_customer_id_key" ON "subscriptions"("razorpay_customer_id")';
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'razorpay_subscription_id') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpay_subscription_id_key" ON "subscriptions"("razorpay_subscription_id")';
  END IF;
END $$;
