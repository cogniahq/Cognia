import { API } from "@stoplight/elements"

import "@stoplight/elements/styles.min.css"

import { PageHeader } from "@/components/shared/PageHeader"

/**
 * Renders the public Cognia API reference from the live OpenAPI spec at
 * /openapi.json (served by api/src/routes/openapi.route.ts).
 *
 * The previous docs page was 1032 lines of hand-written content covering
 * only legacy JWT auth — it did not document API keys, /v1, MCP, or scopes.
 * Replaced with a Stoplight Elements renderer driven by the spec so the
 * docs stay in lockstep with what the server actually serves.
 *
 * Stoplight injects its own styles via @stoplight/elements/styles.min.css
 * (imported above). The .docs-renderer wrapper below scopes the rendered
 * content so its layout primitives don't clash with the surrounding
 * Tailwind-styled PageHeader / page chrome.
 */
export function Docs() {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader />
      <div className="docs-renderer h-[calc(100vh-3.5rem)]">
        <API apiDescriptionUrl="/openapi.json" router="hash" layout="sidebar" />
      </div>
    </div>
  )
}

export default Docs
