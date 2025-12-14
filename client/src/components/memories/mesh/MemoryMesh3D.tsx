import React, { memo, useCallback, useEffect, useRef, useState } from "react"
import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import { useMemoryMesh } from "../../../hooks/use-memory-mesh"
import type { MemoryMesh } from "../../../types/memory"
import { ErrorMessage, LoadingSpinner } from "../../ui/loading-spinner"
import { MemoryMesh3DScene } from "./MemoryMesh3DScene"

interface MemoryMesh3DProps {
  className?: string
  onNodeClick?: (memoryId: string) => void
  similarityThreshold?: number
  selectedMemoryId?: string
  highlightedMemoryIds?: string[]
  onMeshLoad?: (mesh: MemoryMesh) => void
  memorySources?: Record<string, string>
  memoryUrls?: Record<string, string>
  developerAppId?: string
}

const ControlsUpdater: React.FC<{
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}> = ({ controlsRef }) => {
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update()
    }
  })
  return null
}

const MemoryMesh3D: React.FC<MemoryMesh3DProps> = ({
  className = "",
  onNodeClick,
  similarityThreshold = 0.4,
  selectedMemoryId,
  highlightedMemoryIds = [],
  onMeshLoad,
  memorySources,
  memoryUrls,
  developerAppId,
}) => {
  const [isCompactView, setIsCompactView] = useState(false)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const { meshData, isLoading, error } = useMemoryMesh(
    similarityThreshold,
    onMeshLoad,
    developerAppId
  )

  useEffect(() => {
    if (!controlsRef.current) return
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }, [controlsRef, meshData])

  const handleNodeClick = useCallback(
    (memoryId: string) => {
      if (onNodeClick) {
        onNodeClick(memoryId)
      }
    },
    [onNodeClick]
  )

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "c" || event.key === "C") {
        setIsCompactView((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [])

  if (isLoading) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200">
          <ErrorMessage message={error} />
        </div>
      </div>
    )
  }

  if (!meshData) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200">
          <div className="text-sm font-mono text-gray-600">[NO MESH DATA]</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <div className="w-full h-full overflow-hidden relative bg-transparent">
        <Canvas
          camera={{
            position: isCompactView ? [0.8, 0.8, 0.8] : [1.1, 1.1, 1.1],
            fov: isCompactView ? 75 : 60,
            near: 0.0001,
            far: 1000000000,
          }}
          style={{ background: "transparent" }}
          dpr={[1, 1.75]}
          onPointerMissed={() => { }}
        >
          <MemoryMesh3DScene
            meshData={meshData}
            selectedMemoryId={selectedMemoryId}
            highlightedMemoryIds={highlightedMemoryIds}
            memorySources={memorySources}
            memoryUrls={memoryUrls}
            onNodeClick={handleNodeClick}
            isCompactView={isCompactView}
          />
          <OrbitControls
            ref={controlsRef}
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            zoomToCursor={true}
            minDistance={0}
            maxDistance={Infinity}
            zoomSpeed={1.2}
            panSpeed={0.8}
            rotateSpeed={0.5}
            target={[0, 0, 0]}
            enableDamping={true}
            dampingFactor={0.05}
            autoRotate={false}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN,
            }}
          />
          <ControlsUpdater controlsRef={controlsRef} />
        </Canvas>
      </div>
    </div>
  )
}

export { MemoryMesh3D }
export default memo(MemoryMesh3D)
