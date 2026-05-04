/**
 * Lays out a MemoryMesh's nodes in normalised 3D space. Mirrors
 * client/src/utils/mesh/positioning.util.ts. Inputs come straight from the
 * /mesh endpoint; outputs are the per-node tuple consumed by the 3D
 * scene's MemoryMesh3DNode children.
 */

import type { MemoryMesh } from "@/types/memory";

interface NodePosition {
  id: string;
  memoryId: string;
  position: [number, number, number];
  color: string;
  isSelected: boolean;
  isHighlighted: boolean;
  importance?: number;
  inLatentSpace?: boolean;
}

export function calculateNodePositions(
  meshData: MemoryMesh,
  selectedMemoryId: string | undefined,
  highlightedMemoryIds: string[],
  resolveNodeColor: (rawType?: string, url?: string) => string,
  memorySources?: Record<string, string>,
  memoryUrls?: Record<string, string>,
  isCompactView: boolean = false,
): NodePosition[] {
  if (!meshData?.nodes?.length) return [];

  const nodeCount = meshData.nodes.length;
  const radius = isCompactView ? 1.0 : 1.6;
  const zRadius = radius * 0.8;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  const positions: [number, number, number][] = new Array(nodeCount);
  const highlightedSet = new Set(highlightedMemoryIds);
  const memorySourcesMap = memorySources
    ? new Map(Object.entries(memorySources))
    : null;
  const memoryUrlsMap = memoryUrls ? new Map(Object.entries(memoryUrls)) : null;

  for (let i = 0; i < nodeCount; i++) {
    const n = meshData.nodes[i];
    let position: [number, number, number];

    if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
      const x = n.x;
      const y = n.y;
      const z =
        "z" in n && typeof n.z === "number" && Number.isFinite(n.z)
          ? n.z
          : ((n.importance_score ?? 0.5) - 0.5) * 2 * 1000;

      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);

      position = [x, y, z];
    } else {
      const rr = (isCompactView ? radius * 0.4 : radius * 0.55) + i * 0.008;
      const theta = (i / Math.max(1, nodeCount)) * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      position = [
        rr * Math.sin(phi) * Math.cos(theta),
        rr * Math.sin(phi) * Math.sin(theta),
        rr * Math.cos(phi),
      ];
    }

    positions[i] = position;
  }

  const spanX = Math.max(1e-6, maxX - minX);
  const spanY = Math.max(1e-6, maxY - minY);
  const spanZ = Math.max(1e-6, maxZ - minZ);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  const normalizedPositions: [number, number, number][] = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    const n = meshData.nodes[i];
    const pos = positions[i];

    if (Number.isFinite(n.x) && Number.isFinite(n.y)) {
      const nx = ((pos[0] - centerX) / spanX) * radius * 2;
      const ny = ((pos[1] - centerY) / spanY) * radius * 2;
      const nz = ((pos[2] - centerZ) / spanZ) * zRadius * 2;
      normalizedPositions[i] = [nx, ny, nz];
    } else {
      normalizedPositions[i] = [pos[0], pos[1], pos[2]];
    }
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  for (let i = 0; i < nodeCount; i++) {
    sumX += normalizedPositions[i][0];
    sumY += normalizedPositions[i][1];
    sumZ += normalizedPositions[i][2];
  }
  const finalCenterX = sumX / nodeCount;
  const finalCenterY = sumY / nodeCount;
  const finalCenterZ = sumZ / nodeCount;

  const result: NodePosition[] = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    const n = meshData.nodes[i];
    const pos = normalizedPositions[i];
    const finalPos: [number, number, number] = [
      pos[0] - finalCenterX,
      pos[1] - finalCenterY,
      pos[2] - finalCenterZ,
    ];

    const sourceType = memorySourcesMap?.get(n.memory_id || "");
    const url = memoryUrlsMap?.get(n.memory_id || "");
    const color = resolveNodeColor(String(sourceType || n.type), url);

    result[i] = {
      id: n.id,
      memoryId: n.memory_id || "",
      position: finalPos,
      color,
      isSelected: selectedMemoryId === n.memory_id,
      isHighlighted: highlightedSet.has(n.memory_id || ""),
      importance: n.importance_score,
      inLatentSpace: n.hasEmbedding === true,
    };
  }

  return result;
}
