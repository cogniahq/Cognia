interface ImportMetaEnv {
  readonly EXT_API_BASE_URL?: string
  readonly EXT_API_ENDPOINT?: string
  readonly EXT_ENABLE_DEBUG?: string
  readonly NODE_ENV?: 'development' | 'production' | 'test'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
