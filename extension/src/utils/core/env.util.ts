/**
 * Environment variables available in the extension
 * These are injected at build time via esbuild's define option
 *
 * To use environment variables:
 * 1. Create a .env file in the extension root (see .env.example)
 * 2. Variables prefixed with EXT_ will be available via import.meta.env
 * 3. Access them through this env object for type safety
 */

// Access env vars directly - esbuild will replace these at build time
export const env = {
  get API_BASE_URL() {
    return import.meta.env.EXT_API_BASE_URL || 'http://localhost:3000'
  },
  get API_ENDPOINT() {
    return import.meta.env.EXT_API_ENDPOINT || 'http://localhost:3000/api/memory/process'
  },
  get NODE_ENV() {
    return (import.meta.env.NODE_ENV || 'development') as 'development' | 'production' | 'test'
  },
  get ENABLE_DEBUG() {
    return import.meta.env.EXT_ENABLE_DEBUG === 'true'
  },
} as const
