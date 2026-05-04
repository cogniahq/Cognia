import type { MetadataRoute } from "next"

const SITE_URL = "https://cogniahq.tech"

/**
 * Public, indexable routes only. Auth + app routes live behind the auth
 * middleware and shouldn't be in the sitemap. Phase 1 expands this with
 * the real marketing routes once they're ported.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return [
    {
      url: SITE_URL,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
