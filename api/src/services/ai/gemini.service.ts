import { GoogleGenAI } from '@google/genai'
import { GeminiEmbeddingService } from './gemini-embedding.service'
import { GeminiGenerationService } from './gemini-generation.service'
import type { ContentMetadata } from '../../types/ai.types'

export const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'text-embedding-004'

export class GeminiService {
  private ai: GoogleGenAI | null
  private embeddingService: GeminiEmbeddingService
  private generationService: GeminiGenerationService

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      this.ai = null
      this.embeddingService = new GeminiEmbeddingService(null)
      this.generationService = new GeminiGenerationService(null)
      return
    }
    try {
      this.ai = new GoogleGenAI({ apiKey })
      this.embeddingService = new GeminiEmbeddingService(this.ai)
      this.generationService = new GeminiGenerationService(this.ai)
    } catch {
      this.ai = null
      this.embeddingService = new GeminiEmbeddingService(null)
      this.generationService = new GeminiGenerationService(null)
    }
  }

  get isInitialized(): boolean {
    return !!this.ai
  }

  async generateContent(
    prompt: string,
    isSearchRequest: boolean = false,
    timeoutOverride?: number,
    isEmailDraft: boolean = false
  ): Promise<{ text: string; modelUsed?: string; inputTokens?: number; outputTokens?: number }> {
    return this.generationService.generateContent(
      prompt,
      isSearchRequest,
      timeoutOverride,
      isEmailDraft
    )
  }

  async generateEmbedding(text: string): Promise<{
    embedding: number[]
    modelUsed?: string
    inputTokens?: number
    outputTokens?: number
  }> {
    return this.embeddingService.generateEmbedding(text)
  }

  async summarizeContent(
    rawText: string,
    metadata?: ContentMetadata,
    timeoutOverride?: number
  ): Promise<{ text: string; modelUsed?: string; inputTokens?: number; outputTokens?: number }> {
    return this.generationService.summarizeContent(rawText, metadata, timeoutOverride)
  }

  async extractContentMetadata(
    rawText: string,
    metadata?: ContentMetadata,
    timeoutOverride?: number
  ): Promise<{
    metadata: {
      topics: string[]
      categories: string[]
      keyPoints: string[]
      sentiment: string
      importance: number
      usefulness: number
      searchableTerms: string[]
      contextRelevance: string[]
    }
    modelUsed?: string
    inputTokens?: number
    outputTokens?: number
  }> {
    return this.generationService.extractContentMetadata(rawText, metadata, timeoutOverride)
  }

  async evaluateMemoryRelationship(
    memoryA: { title?: string; content?: string; topics?: string[]; categories?: string[] },
    memoryB: { title?: string; content?: string; topics?: string[]; categories?: string[] }
  ): Promise<{
    isRelevant: boolean
    relevanceScore: number
    relationshipType: string
    reasoning: string
  }> {
    return this.generationService.evaluateMemoryRelationship(memoryA, memoryB)
  }

  async generateContentWithImage(
    prompt: string,
    imageBase64: string,
    mimeType: string,
    timeoutOverride?: number
  ): Promise<string> {
    return this.generationService.generateContentWithImage(prompt, imageBase64, mimeType, timeoutOverride)
  }
}

export const geminiService = new GeminiService()
