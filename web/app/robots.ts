import type { MetadataRoute } from "next"

const SITE_URL = "https://cogniahq.tech"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/signup",
          "/auth/",
          "/onboarding/",
          "/organization",
          "/upcoming",
          "/analytics",
          "/profile",
          "/integrations",
          "/docs",
          "/settings/",
          "/billing",
          "/org-admin/",
          "/mesh-showcase",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
