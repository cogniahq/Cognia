import React, { memo, useEffect, useMemo } from "react"
import { useThree } from "@react-three/fiber"
import type { MemoryMesh, MemoryMeshEdge } from "../../../types/memory"
import { calculateNodePositions } from "../../../utils/mesh/positioning.util"
import { resolveNodeColor } from "../../../utils/mesh/colors.util"
import { MemoryMesh3DNode } from "./MemoryMesh3DNode"
import { MemoryMesh3DEdge } from "./MemoryMesh3DEdge"

interface MemoryMesh3DSceneProps {
  meshData: MemoryMesh
  selectedMemoryId?: string
  highlightedMemoryIds: string[]
  memorySources?: Record<string, string>
  memoryUrls?: Record<string, string>
  onNodeClick: (memoryId: string) => void
  isCompactView?: boolean
}

export const MemoryMesh3DScene: React.FC<MemoryMesh3DSceneProps> = ({
  meshData,
  selectedMemoryId,
  highlightedMemoryIds,
  memorySources,
  memoryUrls,
  onNodeClick,
  isCompactView = false,
}) => {
  const { camera } = useThree()

  useEffect(() => {
    if (isCompactView) {
      camera.position.set(0.8, 0.8, 0.8)
    } else {
      camera.position.set(1.1, 1.1, 1.1)
    }
    camera.lookAt(0, 0, 0)
  }, [camera, isCompactView])

  const nodes = useMemo(() => {
    return calculateNodePositions(
      meshData,
      selectedMemoryId,
      highlightedMemoryIds,
      resolveNodeColor,
      memorySources,
      memoryUrls,
      isCompactView
    )
  }, [
    meshData,
    selectedMemoryId,
    highlightedMemoryIds,
    memorySources,
    memoryUrls,
    isCompactView,
  ])

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
      relationType?: string
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
          relationType: best.relation_type,
        })
      }
    })

    return result
  }, [meshData, nodes])

  const visibleData = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], edges: [] }

    const maxVisibleNodes = Infinity
    const maxVisibleEdges = Infinity

    const priorityNodes = nodes.filter((n) => n.isSelected || n.isHighlighted)
    const otherNodes = nodes.filter((n) => !n.isSelected && !n.isHighlighted)

    const visibleNodes =
      maxVisibleNodes === Infinity
        ? nodes
        : [
            ...priorityNodes,
            ...otherNodes.slice(
              0,
              Math.max(0, maxVisibleNodes - priorityNodes.length)
            ),
          ]

    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id))
    const nodePosMap = new Map<string, string>()
    nodes.forEach((n) => {
      const posKey = `${n.position[0].toFixed(3)},${n.position[1].toFixed(3)},${n.position[2].toFixed(3)}`
      nodePosMap.set(posKey, n.id)
    })

    const filteredEdges = edges
      .filter((edge) => {
        const startKey = `${edge.start[0].toFixed(3)},${edge.start[1].toFixed(3)},${edge.start[2].toFixed(3)}`
        const endKey = `${edge.end[0].toFixed(3)},${edge.end[1].toFixed(3)},${edge.end[2].toFixed(3)}`
        const startId = nodePosMap.get(startKey)
        const endId = nodePosMap.get(endKey)

        return (
          (startId &&
            visibleNodeIds.has(startId) &&
            endId &&
            visibleNodeIds.has(endId)) ||
          edge.similarity >= 0.2
        )
      })
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, maxVisibleEdges === Infinity ? edges.length : maxVisibleEdges)

    return { nodes: visibleNodes, edges: filteredEdges }
  }, [nodes, edges])

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[8, 8, 6]} intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={0.2} color="#ffffff" />

      <group>
        {visibleData.nodes.map((node) => (
          <MemoryMesh3DNode
            key={node.id}
            position={node.position}
            memoryId={node.memoryId}
            color={node.color}
            isSelected={node.isSelected}
            isHighlighted={node.isHighlighted}
            importance={node.importance}
            inLatentSpace={node.inLatentSpace}
            onClick={onNodeClick}
          />
        ))}

        {visibleData.edges.map((edge, index) => (
          <MemoryMesh3DEdge
            key={`edge-${index}-${edge.start.join(",")}-${edge.end.join(",")}`}
            start={edge.start}
            end={edge.end}
            similarity={edge.similarity}
            relationType={edge.relationType}
          />
        ))}
      </group>
    </>
  )
}

export default memo(MemoryMesh3DScene)

