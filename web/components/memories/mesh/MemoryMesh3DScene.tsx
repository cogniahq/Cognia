"use client";

/**
 * Three.js scene for the org memory mesh. Identical algorithm to
 * client/src/components/memories/mesh/MemoryMesh3DScene.tsx — recycled
 * tile rendering with per-tile opacity fade so an infinite vertical scroll
 * keeps coordinates bounded and never shows a seam between tiles.
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { MemoryMesh, MemoryMeshEdge } from "@/types/memory";
import { resolveNodeColor } from "@/utils/mesh/colors";
import { calculateNodePositions } from "@/utils/mesh/positioning";
import { MemoryMesh3DEdge } from "./MemoryMesh3DEdge";
import { MemoryMesh3DNode } from "./MemoryMesh3DNode";

interface MemoryMesh3DSceneProps {
  meshData: MemoryMesh;
  selectedMemoryId?: string;
  highlightedMemoryIds: string[];
  memorySources?: Record<string, string>;
  memoryUrls?: Record<string, string>;
  onNodeClick: (memoryId: string) => void;
  isCompactView?: boolean;
  controlsRef?: React.RefObject<OrbitControlsImpl | null>;
}

interface PositionedNode {
  id: string;
  memoryId: string;
  position: [number, number, number];
  color: string;
  isSelected: boolean;
  isHighlighted: boolean;
  importance?: number;
  inLatentSpace?: boolean;
}

interface PositionedEdge {
  start: [number, number, number];
  end: [number, number, number];
  similarity: number;
  relationType?: string;
}

const TILE_RADIUS = 1;
const TILE_GAP_RATIO = 0.15;
const TILE_FADE_RATIO = 0.25;
const REBASE_THRESHOLD = 4;

function MemoryMesh3DSceneComponent({
  meshData,
  selectedMemoryId,
  highlightedMemoryIds,
  memorySources,
  memoryUrls,
  onNodeClick,
  isCompactView = false,
  controlsRef,
}: MemoryMesh3DSceneProps) {
  const { camera } = useThree();

  useEffect(() => {
    if (isCompactView) {
      camera.position.set(0.8, 0.8, 0.8);
    } else {
      camera.position.set(1.1, 1.1, 1.1);
    }
    camera.lookAt(0, 0, 0);
  }, [camera, isCompactView]);

  const nodes = useMemo<PositionedNode[]>(() => {
    return calculateNodePositions(
      meshData,
      selectedMemoryId,
      highlightedMemoryIds,
      resolveNodeColor,
      memorySources,
      memoryUrls,
      isCompactView,
    );
  }, [
    meshData,
    selectedMemoryId,
    highlightedMemoryIds,
    memorySources,
    memoryUrls,
    isCompactView,
  ]);

  const edges = useMemo<PositionedEdge[]>(() => {
    if (!meshData?.edges?.length) return [];

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const groups = new Map<string, MemoryMeshEdge[]>();
    meshData.edges.forEach((e: MemoryMeshEdge) => {
      if (e.source === e.target) return;
      const [a, b] =
        e.source < e.target ? [e.source, e.target] : [e.target, e.source];
      const key = `${a}__${b}`;
      const list = groups.get(key) || [];
      list.push(e);
      groups.set(key, list);
    });

    const result: PositionedEdge[] = [];

    groups.forEach((edgesForPair: MemoryMeshEdge[]) => {
      const best = edgesForPair.reduce<MemoryMeshEdge | undefined>(
        (prev, curr) => {
          if (prev == null) return curr;
          const ps =
            typeof prev.similarity_score === "number"
              ? prev.similarity_score
              : -Infinity;
          const cs =
            typeof curr.similarity_score === "number"
              ? curr.similarity_score
              : -Infinity;
          return cs > ps ? curr : prev;
        },
        edgesForPair[0],
      ) as MemoryMeshEdge;

      const sourceNode = nodeMap.get(best.source);
      const targetNode = nodeMap.get(best.target);

      if (sourceNode && targetNode) {
        result.push({
          start: sourceNode.position,
          end: targetNode.position,
          similarity: best.similarity_score || 0.5,
          relationType: best.relation_type,
        });
      }
    });

    return result;
  }, [meshData, nodes]);

  const verticalLayout = useMemo(() => {
    if (!nodes.length) {
      return { minY: 0, maxY: 0, spanY: 0, tileHeight: 0 };
    }
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const y = nodes[i].position[1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const spanY = Math.max(1e-3, maxY - minY);
    const tileHeight = spanY * (1 + TILE_GAP_RATIO);
    return { minY, maxY, spanY, tileHeight };
  }, [nodes]);

  const [activeTile, setActiveTile] = useState(0);
  const activeTileRef = useRef(0);
  activeTileRef.current = activeTile;

  const targetYRef = useRef(0);
  const [targetYState, setTargetYState] = useState(0);
  const lastReportedTargetYRef = useRef(0);

  useEffect(() => {
    setActiveTile(0);
    targetYRef.current = 0;
    lastReportedTargetYRef.current = 0;
    setTargetYState(0);
  }, [meshData]);

  useFrame(() => {
    const tileHeight = verticalLayout.tileHeight;
    if (tileHeight <= 0) return;

    const controls = controlsRef?.current;
    const targetY = controls ? controls.target.y : camera.position.y;
    targetYRef.current = targetY;

    const epsilon = tileHeight * 0.01;
    if (Math.abs(targetY - lastReportedTargetYRef.current) > epsilon) {
      lastReportedTargetYRef.current = targetY;
      setTargetYState(targetY);
    }

    const desiredTile = Math.round(targetY / tileHeight);
    if (desiredTile !== activeTileRef.current) {
      activeTileRef.current = desiredTile;
      setActiveTile(desiredTile);
    }

    if (controls && Math.abs(desiredTile) >= REBASE_THRESHOLD) {
      const shiftWorld = desiredTile * tileHeight;
      controls.target.y -= shiftWorld;
      camera.position.y -= shiftWorld;
      controls.update();
      activeTileRef.current = 0;
      lastReportedTargetYRef.current = controls.target.y;
      setActiveTile(0);
      setTargetYState(controls.target.y);
    }
  });

  const tiles = useMemo(() => {
    const tileHeight = verticalLayout.tileHeight;
    if (tileHeight <= 0 || !nodes.length) {
      return [] as Array<{
        offset: number;
        centerY: number;
        nodes: PositionedNode[];
        edges: PositionedEdge[];
      }>;
    }

    const out: Array<{
      offset: number;
      centerY: number;
      nodes: PositionedNode[];
      edges: PositionedEdge[];
    }> = [];

    for (let k = -TILE_RADIUS; k <= TILE_RADIUS; k++) {
      const offset = activeTile + k;
      const offsetY = offset * tileHeight;
      const tileNodes = nodes.map<PositionedNode>((n) => ({
        ...n,
        position: [n.position[0], n.position[1] + offsetY, n.position[2]],
      }));
      const tileEdges = edges.map<PositionedEdge>((e) => ({
        start: [e.start[0], e.start[1] + offsetY, e.start[2]],
        end: [e.end[0], e.end[1] + offsetY, e.end[2]],
        similarity: e.similarity,
        relationType: e.relationType,
      }));
      out.push({
        offset,
        centerY: offsetY,
        nodes: tileNodes,
        edges: tileEdges,
      });
    }

    return out;
  }, [activeTile, nodes, edges, verticalLayout]);

  const tilesWithVisible = useMemo(() => {
    return tiles.map((tile) => {
      if (tile.nodes.length === 0) {
        return { ...tile, visibleNodes: [], visibleEdges: [] };
      }

      const priorityNodes = tile.nodes.filter(
        (n) => n.isSelected || n.isHighlighted,
      );
      const otherNodes = tile.nodes.filter(
        (n) => !n.isSelected && !n.isHighlighted,
      );
      const visibleNodes = [...priorityNodes, ...otherNodes];

      const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
      const nodePosMap = new Map<string, string>();
      tile.nodes.forEach((n) => {
        const posKey = `${n.position[0].toFixed(3)},${n.position[1].toFixed(3)},${n.position[2].toFixed(3)}`;
        nodePosMap.set(posKey, n.id);
      });

      const visibleEdges = tile.edges
        .filter((edge) => {
          const startKey = `${edge.start[0].toFixed(3)},${edge.start[1].toFixed(3)},${edge.start[2].toFixed(3)}`;
          const endKey = `${edge.end[0].toFixed(3)},${edge.end[1].toFixed(3)},${edge.end[2].toFixed(3)}`;
          const startId = nodePosMap.get(startKey);
          const endId = nodePosMap.get(endKey);

          return (
            (startId &&
              visibleNodeIds.has(startId) &&
              endId &&
              visibleNodeIds.has(endId)) ||
            edge.similarity >= 0.2
          );
        })
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

      return { ...tile, visibleNodes, visibleEdges };
    });
  }, [tiles]);

  const tileOpacityFor = (centerY: number): number => {
    const tileHeight = verticalLayout.tileHeight;
    if (tileHeight <= 0) return 1;
    const distance = Math.abs(targetYState - centerY);
    const fadeStart = tileHeight * (0.5 - TILE_FADE_RATIO);
    const fadeEnd = tileHeight * (0.5 + TILE_FADE_RATIO);
    if (distance <= fadeStart) return 1;
    if (distance >= fadeEnd) return 0;
    const t = (distance - fadeStart) / Math.max(1e-6, fadeEnd - fadeStart);
    return Math.max(0, Math.min(1, 1 - t));
  };

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[8, 8, 6]} intensity={0.4} />
      <pointLight position={[0, 0, 0]} intensity={0.2} color="#ffffff" />

      {tilesWithVisible.map((tile) => {
        const tileOpacity = tileOpacityFor(tile.centerY);
        if (tileOpacity <= 0) return null;
        return (
          <group key={`tile-${tile.offset}`}>
            {tile.visibleNodes.map((node) => (
              <MemoryMesh3DNode
                key={`tile-${tile.offset}-node-${node.id}`}
                position={node.position}
                memoryId={node.memoryId}
                color={node.color}
                isSelected={node.isSelected}
                isHighlighted={node.isHighlighted}
                importance={node.importance}
                inLatentSpace={node.inLatentSpace}
                onClick={onNodeClick}
                tileOpacity={tileOpacity}
              />
            ))}

            {tile.visibleEdges.map((edge, index) => (
              <MemoryMesh3DEdge
                key={`tile-${tile.offset}-edge-${index}-${edge.start.join(",")}-${edge.end.join(",")}`}
                start={edge.start}
                end={edge.end}
                similarity={edge.similarity}
                relationType={edge.relationType}
                tileOpacity={tileOpacity}
              />
            ))}
          </group>
        );
      })}
    </>
  );
}

export const MemoryMesh3DScene = memo(MemoryMesh3DSceneComponent);
export default MemoryMesh3DScene;
