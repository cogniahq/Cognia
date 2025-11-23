import React, { memo, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

interface MemoryMesh3DNodeProps {
  position: [number, number, number]
  memoryId: string
  color: string
  isSelected: boolean
  isHighlighted: boolean
  importance?: number
  inLatentSpace?: boolean
  onClick: (memoryId: string) => void
}

export const MemoryMesh3DNode: React.FC<MemoryMesh3DNodeProps> = ({
  position,
  memoryId,
  color,
  isSelected,
  isHighlighted,
  importance = 0.5,
  inLatentSpace = true,
  onClick,
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const { camera } = useThree()
  const [hovered, setHovered] = useState(false)

  const baseSize = 0.0035 + importance * 0.0015
  const size = baseSize
  const opacity = inLatentSpace ? 0.95 : 0.75

  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (!meshRef.current || !groupRef.current) return
    const nodePosition = groupRef.current.position
    const distance = camera.position.distanceTo(nodePosition)
    const fovRad =
      camera instanceof THREE.PerspectiveCamera && camera.fov
        ? (camera.fov * Math.PI) / 180
        : (60 * Math.PI) / 180
    const worldPerceivedScale = Math.tan(fovRad / 2) * 2
    const dynamicScale = Math.min(
      6,
      Math.max(0.25, distance * worldPerceivedScale * 0.06)
    )
    const emphasis = isSelected ? 1.8 : isHighlighted ? 1.3 : 1.0
    const hoverBoost = hovered ? 1.15 : 1.0
    meshRef.current.scale.setScalar(dynamicScale * emphasis * hoverBoost)
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation()
          onClick(memoryId)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          setHovered(false)
        }}
      >
        <sphereGeometry args={[size, 6, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 1.0 : opacity}
          depthWrite={true}
          toneMapped={false}
        />
      </mesh>
      <mesh
        visible={false}
        onClick={(e) => {
          e.stopPropagation()
          onClick(memoryId)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
      >
        <sphereGeometry args={[size * 3, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  )
}

export default memo(MemoryMesh3DNode)

