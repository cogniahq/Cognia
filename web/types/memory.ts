/**
 * Subset of the client/ memory types needed by the marketing landing page's
 * 3D mesh preview. Only the shape required by `MemoryMesh3DPreview` is
 * preserved here. Phase 3 will port the full type surface alongside the
 * authenticated `/organization` route.
 */
export interface MemoryMeshNode {
  id: string
  type: "manual" | "browser" | "extension" | "reasoning" | string
  label: string
  x: number
  y: number
  z?: number
  memory_id: string
  title?: string
  preview?: string
  content?: string
  full_content?: string
  importance_score?: number
  hasEmbedding?: boolean
  clusterId?: number
  source?: string
  url?: string
  layout?: {
    isLatentSpace?: boolean
    cluster?: string
    centrality?: number
  }
}

export interface MemoryMeshEdge {
  source: string
  target: string
  relation_type: string
  similarity_score: number
}

export interface MemoryMesh {
  nodes: MemoryMeshNode[]
  edges: MemoryMeshEdge[]
  clusters: {
    [clusterId: string]: string[]
  }
  metadata?: {
    similarity_threshold?: number
    total_nodes?: number
    nodes_in_latent_space?: number
    total_edges?: number
    detected_clusters?: number
    average_connections?: number
    is_latent_space?: boolean
    projection_method?: string
  }
}
