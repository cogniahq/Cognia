"use client";

import dynamic from "next/dynamic";

/**
 * Client-side dynamic import wrapper for MemoryMesh3D. The mesh viz pulls
 * in three / @react-three/fiber / @react-three/drei, all of which touch
 * `window` and `document` at module load. ssr:false defers the entire
 * subtree until hydration. The wrapper is itself a client component
 * because Next 15 forbids `dynamic({ ssr: false })` inside server
 * components.
 */
const MemoryMesh3D = dynamic(
  () => import("./MemoryMesh3D").then((m) => m.MemoryMesh3D),
  { ssr: false },
);

export default MemoryMesh3D;
