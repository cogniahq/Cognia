import { mockMeshData } from "@/data/mock"

import { MeshEmptyState } from "@/components/empty-states/MeshEmptyState"
import { MemoryMesh3DPreview } from "@/components/landing/mesh-preview/MemoryMesh3DPreview"

export function MeshShowcase() {
  const hasNodes = !!mockMeshData?.nodes && mockMeshData.nodes.length > 0

  if (!hasNodes) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white">
        <MeshEmptyState />
      </main>
    )
  }

  return (
    <main
      className="min-h-screen overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 18% 18%, rgba(194,77,44,0.18), transparent 24%), radial-gradient(circle at 84% 20%, rgba(12,125,115,0.18), transparent 28%), linear-gradient(180deg, #f5f1e8 0%, #fcfaf5 42%, #f2ece2 100%)",
      }}
    >
      <div className="absolute inset-0 opacity-35 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "linear-gradient(rgba(23,23,23,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,0.035) 1px, transparent 1px)",
            backgroundSize: "34px 34px",
          }}
        />
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-8">
        <div
          className="w-full max-w-6xl aspect-video border border-black/10 shadow-2xl overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.84) 52%, rgba(255,255,255,0.72) 100%)",
            backdropFilter: "blur(12px)",
          }}
        >
          <MemoryMesh3DPreview
            meshData={mockMeshData}
            showLabels={false}
            interactive={false}
            rotationSpeed={0.28}
          />
        </div>
      </div>
    </main>
  )
}
