"use client"

import dynamic from "next/dynamic"

import { mockMeshData } from "@/data/mock-mesh-data"

// react-three/fiber + drei reach for `window` in their module-init paths,
// so we render the mesh purely client-side. Next 15 only allows ssr:false
// from inside a client component, hence the indirection.
const MemoryMesh3DPreview = dynamic(
  () =>
    import("@/components/landing/mesh-preview/MemoryMesh3DPreview").then(
      (m) => m.MemoryMesh3DPreview
    ),
  { ssr: false }
)

export default function MeshShowcaseClient() {
  const hasNodes = !!mockMeshData?.nodes && mockMeshData.nodes.length > 0

  if (!hasNodes) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-white">
        <div className="text-sm font-mono text-gray-500">
          No mesh data available.
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)] overflow-hidden"
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

      <div className="relative min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-8">
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
    </div>
  )
}
