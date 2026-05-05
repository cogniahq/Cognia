"use client"

import { env } from "@/lib/env"

/**
 * API reference renderer.
 *
 * The Vite app used `@stoplight/elements`'s React component directly, but
 * that package@9 imports the legacy `ReactDOM.render` symbol from react-dom
 * which is no longer exported in React 18's ESM build. Webpack (used by
 * Next.js) refuses to compile that; Vite happened to tolerate it because it
 * resolves CJS imports differently.
 *
 * Until the `@stoplight/elements` upgrade lands, we point an iframe at the
 * standalone Stoplight viewer hosted on jsDelivr — it accepts any public
 * OpenAPI URL via the `?spec=` query and renders the same UI. The spec URL
 * we hand it is `${publicApiUrl}/openapi.json`, so the docs still reflect
 * what the API actually serves.
 *
 * TODO(phase-3-followup): drop the iframe once @stoplight/elements ships
 * a React-18-clean build (or migrate to redocly/stoplight-react).
 */
export default function StoplightDocs() {
  const apiSpecUrl = `${env.publicApiUrl}/openapi.json`
  // The bundled Stoplight Elements distribution accepts the OpenAPI URL via
  // the apiDescriptionUrl param on the standalone HTML viewer:
  // https://elements-demo.stoplight.io/?spec=...
  const viewerUrl = `https://elements-demo.stoplight.io/?spec=${encodeURIComponent(apiSpecUrl)}`
  return (
    <div className="docs-renderer h-[calc(100vh-3.5rem)]">
      <iframe
        src={viewerUrl}
        title="Cognia API Reference"
        className="w-full h-full border-0"
      />
    </div>
  )
}
