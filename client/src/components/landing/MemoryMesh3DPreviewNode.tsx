import React, { useEffect, useMemo, useRef, useState } from "react"
import { Text, useFrame, useThree } from "@react-three/drei"
import * as THREE from "three"

interface MemoryMesh3DPreviewNodeProps {
  position: [number, number, number]
  color: string
  importance?: number
  label?: string
  isHighlighted?: boolean
  pulseIntensity?: number
}

export const MemoryMesh3DPreviewNode: React.FC<
  MemoryMesh3DPreviewNodeProps
> = ({
  position,
  color,
  importance = 0.5,
  label,
  isHighlighted = false,
  pulseIntensity = 0,
}) => {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const textRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const [hovered, setHovered] = useState(false)

  const baseSize = 0.015 + importance * 0.008
  const size = baseSize

  useFrame((state) => {
    if (!meshRef.current || !groupRef.current) return
    const nodePosition = groupRef.current.position
    const distance = camera.position.distanceTo(nodePosition)
    const fovRad =
      camera instanceof THREE.PerspectiveCamera && camera.fov
        ? (camera.fov * Math.PI) / 180
        : (60 * Math.PI) / 180
    const worldPerceivedScale = Math.tan(fovRad / 2) * 2
    const dynamicScale = Math.min(
      8,
      Math.max(0.5, distance * worldPerceivedScale * 0.1)
    )
    const hoverScale = hovered ? 1.3 : 1.0
    const pulseScale = isHighlighted
      ? 1 + Math.sin(state.clock.elapsedTime * 3) * pulseIntensity * 0.3
      : 1.0
    meshRef.current.scale.setScalar(dynamicScale * hoverScale * pulseScale)

    if (textRef.current) {
      textRef.current.lookAt(camera.position)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial
          color={isHighlighted ? "#3b82f6" : color}
          metalness={0.3}
          roughness={0.4}
          emissive={isHighlighted ? "#3b82f6" : color}
          emissiveIntensity={isHighlighted ? 0.6 : hovered ? 0.4 : 0.2}
        />
      </mesh>
      {label && (
        <group ref={textRef}>
          <Text
            position={[0, size * 12, 0]}
            fontSize={0.03}
            color="#000000"
            anchorX="center"
            anchorY="middle"
            maxWidth={5}
            outlineWidth={0.03}
            outlineColor="#ffffff"
            outlineOpacity={1}
            depthOffset={-1}
          >
            {label.length > 30 ? `${label.substring(0, 30)}...` : label}
          </Text>
        </group>
      )}
    </group>
  )
}

