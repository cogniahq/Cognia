-- Bring the four billing tables in line with @prisma/client expectations.
--
-- The original 20260429120000_migrate_to_razorpay migration ran on 2026-05-01
-- before 20260430034015_billing created the tables, so all of its
-- `ALTER TABLE IF EXISTS` statements no-op'd. The billing migration then
-- created the tables with stripe_* columns. Net result: prod has stripe_*
-- columns but Prisma client (and code) expects razorpay_*. Every billing
-- query crashes with `column "razorpay_customer_id" does not exist`.
--
-- All four billing tables are empty pre-launch (verified by SELECT COUNT(*)),
-- so we drop the stripe columns and add the razorpay columns cleanly.
-- For NOT NULL columns we add a temporary DEFAULT then drop it, since
-- Postgres requires a default for ADD COLUMN ... NOT NULL on tables that
-- currently exist (even if empty). Dropping the default afterwards leaves
-- the schema matching schema.prisma exactly.
--
-- Idempotent via IF EXISTS / IF NOT EXISTS so it's safe to re-run on
-- environments where some/all of the prior changes did land.

BEGIN;

-- subscriptions ------------------------------------------------------------
DROP INDEX IF EXISTS "subscriptions_stripe_customer_id_key";
DROP INDEX IF EXISTS "subscriptions_stripe_subscription_id_key";
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_price_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id     TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_plan_id         TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS short_url                TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpay_customer_id_key"     ON subscriptions(razorpay_customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_razorpay_subscription_id_key" ON subscriptions(razorpay_subscription_id);
ALTER TABLE subscriptions ALTER COLUMN status SET DEFAULT 'created';

-- invoices -----------------------------------------------------------------
DROP INDEX IF EXISTS "invoices_stripe_invoice_id_key";
ALTER TABLE invoices DROP COLUMN IF EXISTS amount_due_cents;
ALTER TABLE invoices DROP COLUMN IF EXISTS amount_paid_cents;
ALTER TABLE invoices DROP COLUMN IF EXISTS stripe_invoice_id;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due_paise    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_paid_paise   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_invoice_id TEXT    NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE invoices ALTER COLUMN amount_due_paise    DROP DEFAULT;
ALTER TABLE invoices ALTER COLUMN razorpay_invoice_id DROP DEFAULT;
ALTER TABLE invoices ALTER COLUMN currency SET DEFAULT 'INR';
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_razorpay_invoice_id_key" ON invoices(razorpay_invoice_id);

-- usage_records ------------------------------------------------------------
ALTER TABLE usage_records DROP COLUMN IF EXISTS reported_to_stripe_at;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS reported_to_razorpay_at TIMESTAMP(3);

-- billing_events -----------------------------------------------------------
DROP INDEX IF EXISTS "billing_events_stripe_event_id_key";
ALTER TABLE billing_events DROP COLUMN IF EXISTS stripe_event_id;
ALTER TABLE billing_events ADD COLUMN IF NOT EXISTS razorpay_event_id TEXT NOT NULL DEFAULT '';
ALTER TABLE billing_events ALTER COLUMN razorpay_event_id DROP DEFAULT;
CREATE UNIQUE INDEX IF NOT EXISTS "billing_events_razorpay_event_id_key" ON billing_events(razorpay_event_id);

COMMIT;
