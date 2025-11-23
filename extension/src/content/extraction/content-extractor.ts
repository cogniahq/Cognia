import { sanitizeText, sanitizeContextData } from '@/utils/text'
import type { ContextData } from '@/types/content.types'
import { extractMeaningfulContent, extractFullContent } from './text-extractor'
import {
  extractContentSummary,
  extractContentType,
  extractKeyTopics,
  extractReadingTime,
  extractPageMetadata,
} from './metadata-extractor'
import {
  extractPageStructure,
  extractContentQuality,
  extractUserActivity,
} from './structure-extractor'

export function captureContext(): ContextData {
  try {
    const url = window.location.href
    const title = sanitizeText(document.title || '')
    const meaningfulContent = extractMeaningfulContent()
    const content_snippet = meaningfulContent.substring(0, 500)
    const contextData = {
      source: 'extension',
      url,
      title,
      content_snippet,
      timestamp: Date.now(),
      full_content: extractFullContent(),
      meaningful_content: meaningfulContent,
      content_summary: extractContentSummary(),
      content_type: extractContentType(),
      key_topics: extractKeyTopics(),
      reading_time: extractReadingTime(),
      page_metadata: extractPageMetadata(),
      page_structure: extractPageStructure(),
      user_activity: extractUserActivity(),
      content_quality: extractContentQuality(),
    }
    return sanitizeContextData(contextData) as ContextData
  } catch (_error) {
    const basicTitle = sanitizeText(document.title || 'Untitled Page')
    const basicUrl = window.location.href
    const basicContent = sanitizeText(`Page: ${basicTitle} | URL: ${basicUrl}`)

    return {
      source: 'extension',
      url: basicUrl,
      title: basicTitle,
      content_snippet: basicContent,
      timestamp: Date.now(),
      full_content: basicContent,
      meaningful_content: basicContent,
      content_summary: sanitizeText(`Basic page information for ${basicTitle}`),
      content_type: 'web_page',
      key_topics: [],
      reading_time: 0,
      page_metadata: {
        description: '',
        keywords: '',
        author: '',
        viewport: '',
        language: document.documentElement.lang || '',
        published_date: '',
        modified_date: '',
        canonical_url: '',
      },
      page_structure: {
        headings: [],
        links: [],
        images: [],
        forms: [],
      },
      user_activity: {
        scroll_position: 0,
        window_size: { width: 0, height: 0 },
        focused_element: '',
        time_on_page: 0,
        interaction_count: 0,
      },
      content_quality: {
        word_count: basicContent.split(' ').length,
        has_images: false,
        has_code: false,
        has_tables: false,
        readability_score: 0,
      },
    }
  }
}
