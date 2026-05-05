import type { Metadata } from "next"

import StoplightDocsClient from "@/components/docs/StoplightDocsClient"

export const metadata: Metadata = {
  title: "API Reference",
  robots: { index: false, follow: false },
}

/**
 * Public Cognia API reference rendered from the live OpenAPI spec served
 * by the API at /openapi.json. The actual Stoplight Elements module
 * touches `window` during module init, so the StoplightDocsClient wrapper
 * loads it via next/dynamic({ ssr: false }).
 */
export default function DocsPage() {
  return <StoplightDocsClient />
}
