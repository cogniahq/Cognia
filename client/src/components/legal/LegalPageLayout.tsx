import React from "react"

import { Footer } from "@/components/landing/Footer"
import { Header } from "@/components/landing/Header"

interface LegalPageLayoutProps {
  title: string
  subtitle?: string
  lastUpdated?: string
  children: React.ReactNode
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  title,
  subtitle,
  lastUpdated,
  children,
}) => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <header className="mb-10 border-b border-gray-200 pb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-3 text-base text-gray-600">{subtitle}</p>
            )}
            {lastUpdated && (
              <p className="mt-4 text-xs font-mono uppercase tracking-wide text-gray-500">
                Last updated: {lastUpdated}
              </p>
            )}
          </header>
          <article className="prose prose-gray max-w-none text-gray-800 leading-relaxed">
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  )
}
