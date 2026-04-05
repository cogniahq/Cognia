export type AIProvider = 'gemini' | 'ollama' | 'hybrid' | 'openai'

const VALID_PROVIDERS = new Set<AIProvider>(['gemini', 'ollama', 'hybrid', 'openai'])

export const DEFAULT_AI_PROVIDER: AIProvider = 'openai'
export const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-4o-mini'
export const DEFAULT_OPENAI_VISION_MODEL = 'gpt-4o-mini'
export const DEFAULT_OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-001'
export const DEFAULT_OLLAMA_EMBED_MODEL = 'nomic-embed-text:latest'
export const DEFAULT_OLLAMA_GEN_MODEL = 'llama3.1:8b'
export const DEFAULT_FALLBACK_EMBEDDING_DIMENSION = 768

const OPENAI_EMBEDDING_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

function resolveProvider(rawValue?: string): AIProvider {
  const normalized = rawValue?.trim().toLowerCase()
  if (normalized && VALID_PROVIDERS.has(normalized as AIProvider)) {
    return normalized as AIProvider
  }

  return DEFAULT_AI_PROVIDER
}

export function getLegacyProvider(): AIProvider {
  return resolveProvider(process.env.AI_PROVIDER)
}

export function getEmbedProvider(): AIProvider {
  return resolveProvider(process.env.EMBED_PROVIDER || process.env.AI_PROVIDER)
}

export function getGenerationProvider(): AIProvider {
  return resolveProvider(process.env.GEN_PROVIDER || process.env.AI_PROVIDER)
}

export function getOpenAIApiKey(): string | undefined {
  return process.env.OPENAI_API_KEY
}

export function getOpenAIChatModel(): string {
  return process.env.OPENAI_CHAT_MODEL || DEFAULT_OPENAI_CHAT_MODEL
}

export function getOpenAIVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL || DEFAULT_OPENAI_VISION_MODEL
}

export function getOpenAIEmbeddingModel(): string {
  return process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL
}

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY
}

export function getGeminiEmbeddingModel(): string {
  return process.env.GEMINI_EMBED_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL
}

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
}

export function getOllamaEmbeddingModel(): string {
  return process.env.OLLAMA_EMBED_MODEL || DEFAULT_OLLAMA_EMBED_MODEL
}

export function getOllamaGenerationModel(): string {
  return process.env.OLLAMA_GEN_MODEL || DEFAULT_OLLAMA_GEN_MODEL
}

function getDefaultEmbeddingDimensionForProvider(provider: AIProvider): number {
  if (provider === 'openai' || (provider === 'hybrid' && !!getOpenAIApiKey())) {
    return (
      OPENAI_EMBEDDING_DIMENSIONS[getOpenAIEmbeddingModel()] ||
      OPENAI_EMBEDDING_DIMENSIONS[DEFAULT_OPENAI_EMBEDDING_MODEL]
    )
  }

  return DEFAULT_FALLBACK_EMBEDDING_DIMENSION
}

export function getConfiguredEmbeddingDimension(): number {
  const explicitDimension = Number(process.env.EMBEDDING_DIMENSION)
  if (Number.isFinite(explicitDimension) && explicitDimension > 0) {
    return explicitDimension
  }

  return getDefaultEmbeddingDimensionForProvider(getEmbedProvider())
}

export function getActiveEmbeddingModelName(): string {
  const embedProvider = getEmbedProvider()

  switch (embedProvider) {
    case 'openai':
      return getOpenAIEmbeddingModel()
    case 'hybrid':
      return getOpenAIApiKey() ? getOpenAIEmbeddingModel() : getOllamaEmbeddingModel()
    case 'gemini':
      return getGeminiEmbeddingModel()
    case 'ollama':
      return getOllamaEmbeddingModel()
    default:
      return getOpenAIEmbeddingModel()
  }
}
