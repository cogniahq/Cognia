"use client";

/**
 * 3D mesh viz used by /organization's Mesh tab. Mirrors
 * client/src/components/memories/mesh/MemoryMesh3D.tsx but trimmed to
 * "external mesh data only" — the org route always passes mesh data in
 * via useOrganizationMesh, so the personal-mesh fallback hook from the
 * Vite client isn't needed here.
 */

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { MemoryMesh } from "@/types/memory";
import { MemoryMesh3DScene } from "./MemoryMesh3DScene";

interface MemoryMesh3DProps {
  className?: string;
  meshData: MemoryMesh | null;
  isLoading?: boolean;
  error?: string | null;
  onNodeClick?: (memoryId: string) => void;
  selectedMemoryId?: string;
  highlightedMemoryIds?: string[];
  memorySources?: Record<string, string>;
  memoryUrls?: Record<string, string>;
}

function ControlsUpdater({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.update();
    }
  });
  return null;
}

function MemoryMesh3DComponent({
  className = "",
  meshData,
  isLoading = false,
  error = null,
  onNodeClick,
  selectedMemoryId,
  highlightedMemoryIds = [],
  memorySources,
  memoryUrls,
}: MemoryMesh3DProps) {
  const [isCompactView, setIsCompactView] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Reset orbit target only on the first mesh load — preserve camera Y on
  // subsequent refreshes so vertical scrolling isn't yanked back to 0.
  const didInitialiseTargetRef = useRef(false);
  useEffect(() => {
    if (!controlsRef.current) return;
    if (didInitialiseTargetRef.current) return;
    if (!meshData) return;
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    didInitialiseTargetRef.current = true;
  }, [meshData]);

  const handleNodeClick = useCallback(
    (memoryId: string) => {
      onNodeClick?.(memoryId);
    },
    [onNodeClick],
  );

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "c" || event.key === "C") {
        setIsCompactView((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  if (isLoading) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200">
          <div className="text-sm font-mono text-red-600">[ERROR] {error}</div>
        </div>
      </div>
    );
  }

  if (!meshData) {
    return (
      <div className={`w-full h-full ${className}`}>
        <div className="w-full h-full flex items-center justify-center bg-white border border-gray-200">
          <div className="text-sm font-mono text-gray-600">[NO MESH DATA]</div>
        </div>
      </div>
    );
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
          onPointerMissed={() => {}}
        >
          <MemoryMesh3DScene
            meshData={meshData}
            selectedMemoryId={selectedMemoryId}
            highlightedMemoryIds={highlightedMemoryIds}
            memorySources={memorySources}
            memoryUrls={memoryUrls}
            onNodeClick={handleNodeClick}
            isCompactView={isCompactView}
            controlsRef={controlsRef}
          />
          <OrbitControls
            ref={controlsRef}
            enablePan
            enableZoom
            enableRotate
            zoomToCursor
            minDistance={0}
            maxDistance={Infinity}
            zoomSpeed={1.2}
            panSpeed={0.8}
            rotateSpeed={0.5}
            target={[0, 0, 0]}
            enableDamping
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
  );
}

export const MemoryMesh3D = memo(MemoryMesh3DComponent);
export default MemoryMesh3D;
