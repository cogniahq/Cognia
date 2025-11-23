import React, { memo, useMemo } from "react"
import { Line } from "@react-three/drei"
import * as THREE from "three"

interface MemoryMesh3DEdgeProps {
  start: [number, number, number]
  end: [number, number, number]
  similarity: number
  relationType?: string
}

export const MemoryMesh3DEdge: React.FC<MemoryMesh3DEdgeProps> = ({
  start,
  end,
  similarity,
}) => {
  const points = useMemo(
    () => [new THREE.Vector3(...start), new THREE.Vector3(...end)],
    [start, end]
  )

  const getLineColor = (similarity: number) => {
    if (similarity > 0.85) return "#3b82f6"
    if (similarity > 0.75) return "#38bdf8"
    return "#9ca3af"
  }

  const color = getLineColor(similarity)
  const opacity = similarity > 0.75 ? 0.6 : similarity > 0.5 ? 0.4 : 0.3
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
      depthTest={true}
      depthWrite={false}
    />
  )
}

export default memo(MemoryMesh3DEdge)

