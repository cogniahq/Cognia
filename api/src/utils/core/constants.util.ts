// Memory processing constants
export const MEMORY_CONSTANTS = {
  MAX_CONTENT_LENGTH: 100000, // Maximum characters for content processing
  DEFAULT_MEMORY_LIMIT: 10, // Default number of memories to return
  DEFAULT_SEARCH_LIMIT: 20, // Default search results limit
  DEFAULT_MESH_LIMIT: 50, // Default mesh nodes limit
  DEFAULT_MESH_THRESHOLD: 0.3, // Default similarity threshold for mesh
  DEFAULT_SNAPSHOT_LIMIT: 20, // Default snapshot pagination limit
  DEFAULT_CLUSTER_DEPTH: 2, // Default cluster traversal depth
} as const

// Search constants
export const SEARCH_CONSTANTS = {
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  // First-stage retrieval pool size before reranking. Bounded so HNSW recall
  // stays cheap even when the tenant has millions of vectors.
  FIRST_STAGE_K: 200,
  // Cap on rerank candidates passed to the cross-encoder.
  RERANK_CANDIDATES: 50,
  // Cap on user-extension supplemental retrieval.
  USER_STAGE_K: 80,
  MIN_SIMILARITY_SCORE: 0.15,
  MIN_KEYWORD_SCORE: 0.3,
  MIN_COVERAGE_RATIO: 0.5,
  SEMANTIC_WEIGHT: 0.6,
  KEYWORD_WEIGHT: 0.4,
  EMBEDDING_TIMEOUT: 600000,
  AI_GENERATION_TIMEOUT: 120000,
  AI_ANSWER_TIMEOUT: 180000,
  // Redis TTL for query result cache (seconds).
  QUERY_CACHE_TTL_SECONDS: 60,
  // RRF k constant for reciprocal-rank fusion of dense + sparse stages.
  RRF_K: 60,
} as const

// Mesh and relation constants
export const MESH_CONSTANTS = {
  DEFAULT_SIMILARITY_THRESHOLD: 0.3, // Default similarity threshold
  MIN_SIMILARITY_THRESHOLD: 0.05, // Minimum similarity threshold
  MAX_RELATIONS_PER_MEMORY: 10, // Maximum relations to keep per memory
  CLEANUP_THRESHOLD: 0.3, // Threshold for cleaning up low-quality relations
  CLEANUP_AGE_THRESHOLD: 0.4, // Threshold for old relations cleanup
  CLEANUP_AGE_DAYS: 30, // Days before considering relations old
  SEMANTIC_WEIGHT: 0.05, // Weight for semantic relation type
  TOPICAL_WEIGHT: 0.02, // Weight for topical relation type
  TEMPORAL_WEIGHT: 0, // Weight for temporal relation type
  MAX_DEGREE: 12, // Maximum degree per node in mesh
  MIN_DEGREE: 3, // Minimum degree per node in mesh
  CLUSTER_EPSILON: 250, // Distance threshold for clustering
  CLUSTER_MIN_POINTS: 2, // Minimum points to form a cluster
} as const

// Cache and TTL constants
export const CACHE_CONSTANTS = {
  USER_CACHE_TTL: 5 * 60 * 1000, // 5 minutes in milliseconds
  SEARCH_JOB_TTL: 15 * 60, // 15 minutes in seconds
  RELATIONSHIP_CACHE_TTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  CACHE_CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
} as const

// Request and validation constants
export const REQUEST_CONSTANTS = {
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, // 10MB in bytes
  MAX_CONTENT_SIZE: 100000, // Maximum content length in characters
  DEFAULT_PAGE_SIZE: 10, // Default pagination page size
  MAX_PAGE_SIZE: 100, // Maximum pagination page size
} as const

// AI provider constants
export const AI_CONSTANTS = {
  MIN_INTERVAL_MS: 2000, // Minimum interval between AI requests in milliseconds
  DEFAULT_TIMEOUT: 60000, // Default timeout in milliseconds
  EMBEDDING_TIMEOUT: 180000, // 3 minutes for embeddings
  CONTENT_TIMEOUT: 120000, // 2 minutes for content generation
  MAX_RETRY_ATTEMPTS: 8, // Maximum retry attempts for AI calls
  BASE_RETRY_DELAY: 3000, // Base retry delay in milliseconds
  MAX_RETRY_DELAY: 60000, // Maximum retry delay in milliseconds
} as const

// Queue constants
export const QUEUE_CONSTANTS = {
  DEFAULT_CONCURRENCY: 1, // Default queue concurrency
  DEFAULT_MAX_JOBS: 1000, // Default max jobs to keep
  DEFAULT_ATTEMPTS: 1, // Default job attempts
  DEFAULT_BACKOFF_DELAY: 5000, // Default backoff delay in milliseconds
} as const
