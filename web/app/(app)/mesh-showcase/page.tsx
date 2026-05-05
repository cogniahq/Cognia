import type { Metadata } from "next"

import MeshShowcaseClient from "@/components/mesh-showcase/MeshShowcaseClient"

export const metadata: Metadata = {
  title: "Mesh Showcase",
  robots: { index: false, follow: false },
}

/**
 * Pure 3D demo. The MeshShowcaseClient wrapper is "use client" so it can
 * load the @react-three/fiber-based MemoryMesh3DPreview via
 * next/dynamic({ ssr: false }) — that combo is required because R3F + drei
 * touch `window` during module init, but Next 15 only permits ssr:false
 * from inside a client component.
 */
export default function MeshShowcasePage() {
  return <MeshShowcaseClient />
}
