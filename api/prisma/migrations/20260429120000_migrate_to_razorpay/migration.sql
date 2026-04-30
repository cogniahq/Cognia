-- DropIndex
DROP INDEX "billing_events_stripe_event_id_key";

-- DropIndex
DROP INDEX "invoices_stripe_invoice_id_key";

-- DropIndex
DROP INDEX "subscriptions_stripe_customer_id_key";

-- DropIndex
DROP INDEX "subscriptions_stripe_subscription_id_key";

-- AlterTable
ALTER TABLE "billing_events" DROP COLUMN "stripe_event_id",
ADD COLUMN     "razorpay_event_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "invoices" DROP COLUMN "amount_due_cents",
DROP COLUMN "amount_paid_cents",
DROP COLUMN "stripe_invoice_id",
ADD COLUMN     "amount_due_paise" INTEGER NOT NULL,
ADD COLUMN     "amount_paid_paise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "razorpay_invoice_id" TEXT NOT NULL,
ADD COLUMN     "razorpay_payment_id" TEXT,
ALTER COLUMN "currency" SET DEFAULT 'INR';

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripe_customer_id",
DROP COLUMN "stripe_price_id",
DROP COLUMN "stripe_subscription_id",
ADD COLUMN     "razorpay_customer_id" TEXT,
ADD COLUMN     "razorpay_plan_id" TEXT,
ADD COLUMN     "razorpay_subscription_id" TEXT,
ADD COLUMN     "short_url" TEXT,
ALTER COLUMN "status" SET DEFAULT 'created';

-- AlterTable
ALTER TABLE "usage_records" DROP COLUMN "reported_to_stripe_at",
ADD COLUMN     "reported_to_razorpay_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "billing_events_razorpay_event_id_key" ON "billing_events"("razorpay_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_razorpay_invoice_id_key" ON "invoices"("razorpay_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpay_customer_id_key" ON "subscriptions"("razorpay_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_razorpay_subscription_id_key" ON "subscriptions"("razorpay_subscription_id");

