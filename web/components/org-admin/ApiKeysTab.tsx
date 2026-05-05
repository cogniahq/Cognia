"use client"

import { ApiKeyManager } from "@/components/api-keys/ApiKeyManager"

interface ApiKeysTabProps {
  /** Org id (UUID) — used as the request scope for create/list. */
  orgId: string
  /** Org slug — displayed in the table's "Org" column. */
  slug: string
}

export default function ApiKeysTab({ orgId, slug }: ApiKeysTabProps) {
  return <ApiKeyManager organizationId={orgId} organizationLabel={slug} />
}
