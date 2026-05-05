"use client"

import { memo, useMemo } from "react"
import { Line } from "@react-three/drei"
import * as THREE from "three"

interface MemoryMesh3DEdgeProps {
  start: [number, number, number]
  end: [number, number, number]
  similarity: number
  relationType?: string
  /**
   * Per-tile fade multiplier (1 = fully opaque). Drives the seamless
   * fade at the edges of recycled mesh tiles.
   */
  tileOpacity?: number
}

function MemoryMesh3DEdgeComponent({
  start,
  end,
  similarity,
  tileOpacity = 1,
}: MemoryMesh3DEdgeProps) {
  const points = useMemo(
    () => [new THREE.Vector3(...start), new THREE.Vector3(...end)],
    [start, end]
  )

  const getLineColor = (s: number) => {
    if (s > 0.85) return "#3b82f6"
    if (s > 0.75) return "#38bdf8"
    return "#9ca3af"
  }

  const color = getLineColor(similarity)
  const baseOpacity = similarity > 0.75 ? 0.6 : similarity > 0.5 ? 0.4 : 0.3
  const clampedTileOpacity = Math.max(0, Math.min(1, tileOpacity))
  const opacity = baseOpacity * clampedTileOpacity
  const lineWidth = similarity > 0.85 ? 0.4 : similarity > 0.75 ? 0.3 : 0.2

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      dashed={false}
      toneMapped={false}
      depthTest
      depthWrite={false}
    />
  )
}

export const MemoryMesh3DEdge = memo(MemoryMesh3DEdgeComponent)
export default MemoryMesh3DEdge
