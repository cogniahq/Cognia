import type { Metadata, Viewport } from "next"
import "./globals.css"

const SITE_URL = "https://cogniahq.tech"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cognia — Your team's searchable memory",
    template: "%s · Cognia",
  },
  description:
    "Cognia builds a living, searchable knowledge graph from everything your team writes, reads, and decides — without changing how you work.",
  applicationName: "Cognia",
  keywords: ["knowledge management", "team memory", "searchable knowledge graph", "AI memory"],
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
    description:
      "A living, searchable knowledge graph for your team.",
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
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLdJson) }}
        />
        {children}
      </body>
    </html>
  )
}
