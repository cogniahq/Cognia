import type { Metadata, Viewport } from "next"
import { IBM_Plex_Mono, Inter } from "next/font/google"
import "./globals.css"

const SITE_URL = "https://cogniahq.tech"

// next/font handles preload + self-host out of the box, replacing the
// third-party @import url(...) lines that the Phase 0 globals.css carried
// over from the Vite app.
const inter = Inter({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
})

// TODO(phase-1): self-host PP Editorial via next/font/local once we have the
// .woff2 file. For now it loads from a third-party CDN via @import in
// globals.css; that keeps the editorial typeface working but pays a CORS +
// preconnect tax. Bringing it in-tree is a one-line change once we have the
// font file.

// TODO(phase-1): replace web/public/og-default.png with a real 1200x630
// image. The placeholder is a 1×1 PNG so previews render the alt text only.

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cognia — Your team's searchable memory",
    template: "%s · Cognia",
  },
  description:
    "Cognia builds a living, searchable knowledge graph from everything your team writes, reads, and decides — without changing how you work.",
  applicationName: "Cognia",
  keywords: [
    "knowledge management",
    "team memory",
    "searchable knowledge graph",
    "AI memory",
  ],
  authors: [{ name: "Cognia" }],
  creator: "Cognia",
  publisher: "Cognia",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    siteName: "Cognia",
    locale: "en_US",
    url: SITE_URL,
    title: "Cognia — Your team's searchable memory",
    description:
      "Cognia builds a living, searchable knowledge graph from everything your team writes, reads, and decides — without changing how you work.",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "Cognia",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cognia — Your team's searchable memory",
    description: "A living, searchable knowledge graph for your team.",
    images: ["/og-default.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.ico",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
}

const organizationLdJson = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Cognia",
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${ibmPlexMono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationLdJson),
          }}
        />
        {children}
      </body>
    </html>
  )
}
