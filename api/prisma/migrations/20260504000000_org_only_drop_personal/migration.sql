-- Drop remaining personal-mode columns + enum values now that the org-only
-- onboarding wall is in place.
--
--   1. Hard-delete every memory_share row whose recipient_type='USER'.
--      Direct-to-user shares were a cross-tenant exfiltration vector; the
--      only sanctioned share targets are ORG (membership-gated) and LINK
--      (token-gated). This is pre-launch, so dropping rows is fine.
--   2. Drop MemoryShare.recipient_user_id (column + index + FK).
--   3. Recreate ShareRecipientType without 'USER'. Postgres can't drop
--      enum values in place, so we rename → recreate → cast → drop.
--   4. Drop User.account_type and the AccountType enum entirely.
--
-- Wrapped in a transaction.

BEGIN;

-- 1. Drop USER memory shares.
DELETE FROM memory_shares WHERE recipient_type = 'USER';

-- 2. Drop the recipient_user_id column + its index + its FK.
DROP INDEX IF EXISTS "memory_shares_recipient_user_id_idx";
ALTER TABLE memory_shares DROP CONSTRAINT IF EXISTS "memory_shares_recipient_user_id_fkey";
ALTER TABLE memory_shares DROP COLUMN IF EXISTS "recipient_user_id";

-- 3. Recreate ShareRecipientType without USER.
ALTER TYPE "ShareRecipientType" RENAME TO "ShareRecipientType_old";
CREATE TYPE "ShareRecipientType" AS ENUM ('ORG', 'LINK');
ALTER TABLE memory_shares
  ALTER COLUMN recipient_type TYPE "ShareRecipientType"
  USING recipient_type::text::"ShareRecipientType";
DROP TYPE "ShareRecipientType_old";

-- 4. Drop User.account_type + AccountType enum.
ALTER TABLE users DROP COLUMN IF EXISTS "account_type";
DROP TYPE IF EXISTS "AccountType";

COMMIT;
