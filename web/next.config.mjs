/** @type {import('next').NextConfig} */
const nextConfig = {
  // The new app stays at the same hostname as today (cogniahq.tech). All
  // assets ship from the same origin; no asset prefix dance.
  reactStrictMode: true,
  // We still talk to api.cogniahq.tech directly from the browser — the API
  // sets CORS_ALLOWED_ORIGINS to include cogniahq.tech. No rewrites needed
  // unless we decide later to proxy /api/* via Next.js (we won't for v1).
  async redirects() {
    return [
      // Legacy /memories paths land authed users on /organization. The Vite
      // app already does this in routes.route.tsx; replicate via Next.js
      // redirects so deep links from todos/email/etc. keep working post-cutover.
      { source: "/memories", destination: "/organization", permanent: true },
      {
        source: "/memories/:path*",
        destination: "/organization",
        permanent: true,
      },
      // /memories/v2 specifically redirects too — captured by the wildcard
      // above but keeping a comment for searchability.
    ]
  },
  // Allow next/image to optimize remote assets we need.
  images: {
    remotePatterns: [
      // Anything proxied through the API (signed-storage URLs).
      { protocol: "https", hostname: "api.cogniahq.tech" },
    ],
  },
  // Strip the X-Powered-By header.
  poweredByHeader: false,
}

export default nextConfig
