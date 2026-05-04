-- Org-only product migration.
-- Goals:
--   1. Every user must belong to at least one active org. Users with no
--      active OrganizationMember row get a placeholder personal org
--      auto-created (named "<email-local>'s Workspace") and are added
--      as ADMIN.
--   2. Every memory must have organization_id. Memories with NULL
--      organization_id are reassigned to their owner's first active
--      org (post-step-1, every user has at least one).
--   3. Every API key must be scoped to an org. Keys with NULL
--      organization_id are reassigned to the owner's first active org.
--   4. After backfill: ALTER COLUMN organization_id SET NOT NULL on
--      memories and api_keys.
--
-- All steps wrapped in a transaction. Designed to be re-runnable: each
-- INSERT is idempotent on natural keys; each UPDATE is gated by the
-- IS NULL filter so re-running doesn't double-act.

BEGIN;

-- 1. Backfill placeholder orgs for users without active membership.
DO $$
DECLARE
  rec RECORD;
  new_org_id UUID;
  base_slug TEXT;
  candidate_slug TEXT;
  slug_attempt INT;
BEGIN
  FOR rec IN
    SELECT u.id AS user_id, u.email
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = u.id AND om.deactivated_at IS NULL
    )
  LOOP
    new_org_id := gen_random_uuid();
    base_slug := lower(regexp_replace(
      coalesce(split_part(rec.email, '@', 1), 'workspace'),
      '[^a-z0-9-]+', '-', 'g'
    ));
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'workspace';
    END IF;

    -- Find a free slug; append a short uuid prefix on collision.
    candidate_slug := base_slug;
    slug_attempt := 0;
    WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = candidate_slug) LOOP
      slug_attempt := slug_attempt + 1;
      candidate_slug := base_slug || '-' || substr(replace(new_org_id::text, '-', ''), 1, 6 + slug_attempt);
      EXIT WHEN slug_attempt > 5;
    END LOOP;

    INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
    VALUES (
      new_org_id,
      coalesce(split_part(rec.email, '@', 1), 'Personal') || '''s Workspace',
      candidate_slug,
      'free',
      NOW(), NOW()
    );

    INSERT INTO organization_members (
      id, organization_id, user_id, role, created_at
    )
    VALUES (
      gen_random_uuid(), new_org_id, rec.user_id, 'ADMIN', NOW()
    );
  END LOOP;
END $$;

-- 2. Backfill memories.organization_id from each owner's first active org.
UPDATE memories m
SET organization_id = (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = m.user_id AND om.deactivated_at IS NULL
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE m.organization_id IS NULL;

-- 3. Backfill api_keys.organization_id from each owner's first active org.
UPDATE api_keys k
SET organization_id = (
  SELECT om.organization_id
  FROM organization_members om
  WHERE om.user_id = k.user_id AND om.deactivated_at IS NULL
  ORDER BY om.created_at ASC
  LIMIT 1
)
WHERE k.organization_id IS NULL;

-- 4. Tighten the columns to NOT NULL. Switch the FK ON DELETE policy on
-- memories from SET NULL to CASCADE since the column is no longer nullable.
ALTER TABLE memories
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE memories
  DROP CONSTRAINT IF EXISTS memories_organization_id_fkey;
ALTER TABLE memories
  ADD CONSTRAINT memories_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE api_keys
  ALTER COLUMN organization_id SET NOT NULL;

COMMIT;
