"use client";

import dynamic from "next/dynamic";

/**
 * Client-side dynamic import wrapper for MemoryMeshDemo. The mesh viz pulls
 * in three / @react-three/fiber / @react-three/drei, which all touch
 * `window` and `document` at module load. ssr:false defers the entire
 * subtree until hydration. The wrapper is itself a client component
 * because Next 15 forbids `dynamic({ ssr: false })` inside server
 * components.
 */
const MemoryMeshDemo = dynamic(() => import("./MemoryMeshDemo"), {
  ssr: false,
});

export default MemoryMeshDemo;
