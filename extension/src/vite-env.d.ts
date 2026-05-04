interface ImportMetaEnv {
  readonly EXT_API_BASE_URL?: string
  readonly EXT_API_ENDPOINT?: string
  readonly EXT_ENABLE_DEBUG?: string
  readonly NODE_ENV?: 'development' | 'production' | 'test'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// pdfjs-dist ships the worker as an .mjs file without a sibling .d.ts. We
// import it purely for its side effect (it sets globalThis.pdfjsWorker so
// PDF.js runs in fake-worker mode), so an empty module declaration suffices.
declare module 'pdfjs-dist/build/pdf.worker.mjs'
