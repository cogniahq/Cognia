import React, { memo, useEffect, useMemo, useRef } from "react"
import { useThree, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { MemoryMesh, MemoryMeshEdge } from "../../../types/memory"
import { resolveNodeColor } from "../../../utils/mesh/colors.util"
import { MemoryMesh3DPreviewNode } from "./MemoryMesh3DPreviewNode"
import { MemoryMesh3DPreviewEdge } from "./MemoryMesh3DPreviewEdge"

interface MemoryMesh3DPreviewSceneProps {
  meshData: MemoryMesh
  highlightedNodes?: Set<string>
  pulseIntensity?: number
}

export const MemoryMesh3DPreviewScene: React.FC<
  MemoryMesh3DPreviewSceneProps
> = ({ meshData, highlightedNodes = new Set(), pulseIntensity = 0 }) => {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 0, 3.5)
    camera.lookAt(0, 0, 0)
  }, [camera])

  const nodes = useMemo(() => {
    if (!meshData?.nodes?.length) return []

    const nodeCount = meshData.nodes.length
    const sphereRadius = 1.2

    const normalizedPositions: [number, number, number][] = new Array(nodeCount)

    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.acos(-1 + (2 * i) / nodeCount)
      const phi = Math.sqrt(nodeCount * Math.PI) * theta

      const x = sphereRadius * Math.cos(phi) * Math.sin(theta)
      const y = sphereRadius * Math.sin(phi) * Math.sin(theta)
      const z = sphereRadius * Math.cos(theta)

      normalizedPositions[i] = [x, y, z]
    }

    let sumX = 0
    let sumY = 0
    let sumZ = 0
    for (let i = 0; i < nodeCount; i++) {
      sumX += normalizedPositions[i][0]
      sumY += normalizedPositions[i][1]
      sumZ += normalizedPositions[i][2]
    }
    const finalCenterX = sumX / nodeCount
    const finalCenterY = sumY / nodeCount
    const finalCenterZ = sumZ / nodeCount

    const result = new Array(nodeCount)
    for (let i = 0; i < nodeCount; i++) {
      const n = meshData.nodes[i]
      const pos = normalizedPositions[i]
      const finalPos: [number, number, number] = [
        pos[0] - finalCenterX,
        pos[1] - finalCenterY,
        pos[2] - finalCenterZ,
      ]

      const color = resolveNodeColor(String(n.type))

      result[i] = {
        id: n.id,
        position: finalPos,
        color,
        importance: n.importance_score,
        label: n.title || n.label || "",
      }
    }

    return result as Array<{
      id: string
      position: [number, number, number]
      color: string
      importance?: number
      label?: string
    }>
  }, [meshData])

  const edges = useMemo(() => {
    if (!meshData?.edges?.length) return []

    const nodeMap = new Map(nodes.map((n) => [n.id, n]))

    const groups = new Map<string, MemoryMeshEdge[]>()
    meshData.edges.forEach((e: MemoryMeshEdge) => {
      if (e.source === e.target) return
      const [a, b] =
        e.source < e.target ? [e.source, e.target] : [e.target, e.source]
      const key = `${a}__${b}`
      const list = groups.get(key) || []
      list.push(e)
      groups.set(key, list)
    })

    const result: Array<{
      start: [number, number, number]
      end: [number, number, number]
      similarity: number
    }> = []

    groups.forEach((edgesForPair: MemoryMeshEdge[]) => {
      const best = edgesForPair.reduce<MemoryMeshEdge | undefined>(
        (prev, curr) => {
          if (prev == null) return curr
          const ps =
            typeof prev.similarity_score === "number"
              ? prev.similarity_score
              : -Infinity
          const cs =
            typeof curr.similarity_score === "number"
              ? curr.similarity_score
              : -Infinity
          return cs > ps ? curr : prev
        },
        edgesForPair[0]
      ) as MemoryMeshEdge

      const sourceNode = nodeMap.get(best.source)
      const targetNode = nodeMap.get(best.target)

      if (sourceNode && targetNode) {
        result.push({
          start: sourceNode.position,
          end: targetNode.position,
          similarity: best.similarity_score || 0.5,
        })
      }
    })

    return result
  }, [meshData, nodes])

  return (
    <>
      <fog attach="fog" args={["#f9fafb", 1.5, 6]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 8]} intensity={1.0} />
      <directionalLight position={[-10, -10, -8]} intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#ffffff" />

      <group>
        {nodes.map((node) => (
          <MemoryMesh3DPreviewNode
            key={node.id}
            position={node.position}
            color={node.color}
            importance={node.importance}
            label={node.label}
            isHighlighted={highlightedNodes.has(node.id)}
            pulseIntensity={highlightedNodes.has(node.id) ? pulseIntensity : 0}
          />
        ))}

        {edges.map((edge, index) => (
          <MemoryMesh3DPreviewEdge
            key={`edge-${index}-${edge.start.join(",")}-${edge.end.join(",")}`}
            start={edge.start}
            end={edge.end}
            similarity={edge.similarity}
          />
        ))}
      </group>
    </>
  )
}

import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { useRef } from "react"

const RotatingMesh: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.1
    }
  })

  return <group ref={groupRef}>{children}</group>
}

export default memo(MemoryMesh3DPreviewScene)

