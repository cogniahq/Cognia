-- Drop legal/CA/tax-audit vertical specialization columns from Organization.
-- Cognia is now a generic team-knowledge platform with no per-vertical pack.
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "domain_pack";
