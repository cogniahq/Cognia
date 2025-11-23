import React, { memo, useRef } from "react"
import { OrbitControls } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"

import type { MemoryMesh } from "../../types/memory"
import { MemoryMesh3DPreviewScene } from "./MemoryMesh3DPreviewScene"

interface MemoryMesh3DPreviewProps {
  meshData: MemoryMesh
  highlightedNodes?: Set<string>
  pulseIntensity?: number
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

export const MemoryMesh3DPreview: React.FC<MemoryMesh3DPreviewProps> = ({
  meshData,
  highlightedNodes = new Set(),
  pulseIntensity = 0,
}) => {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  return (
    <Canvas
      camera={{
        position: [0, 0, 3.5],
        fov: 50,
        near: 0.1,
        far: 100,
      }}
      style={{ background: "transparent" }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <MemoryMesh3DPreviewScene
        meshData={meshData}
        highlightedNodes={highlightedNodes}
        pulseIntensity={pulseIntensity}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={false}
        enableRotate={true}
        zoomToCursor={true}
        minDistance={2}
        maxDistance={8}
        zoomSpeed={1.2}
        panSpeed={0.8}
        rotateSpeed={0.5}
        target={[0, 0, 0]}
        enableDamping={true}
        dampingFactor={0.05}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
      <ControlsUpdater controlsRef={controlsRef} />
    </Canvas>
  )
}

export const MemoryMesh3DContainer = memo(MemoryMesh3DPreview)
MemoryMesh3DContainer.displayName = "MemoryMesh3DContainer"

