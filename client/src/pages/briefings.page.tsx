import BriefingFeed from "@/components/briefing/BriefingFeed"
import BriefingPreferences from "@/components/briefing/BriefingPreferences"
import { PageHeader } from "@/components/shared/PageHeader"

export function Briefings() {
  return (
    <div
      className="min-h-screen bg-white"
      style={{
        backgroundImage: "linear-gradient(135deg, #f9fafb, #ffffff, #f3f4f6)",
      }}
    >
      <PageHeader pageName="Briefings" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <BriefingFeed />
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-20">
              <BriefingPreferences />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
