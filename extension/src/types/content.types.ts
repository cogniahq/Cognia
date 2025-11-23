export interface ContextData {
  source: string
  url: string
  title: string
  content_snippet: string
  timestamp: number
  full_content?: string
  meaningful_content?: string
  content_summary?: string
  content_type?: string
  key_topics?: string[]
  reading_time?: number
  page_metadata?: {
    description?: string
    keywords?: string
    author?: string
    viewport?: string
    language?: string
    published_date?: string
    modified_date?: string
    canonical_url?: string
  }
  page_structure?: {
    headings: string[]
    links: string[]
    images: string[]
    forms: string[]
    code_blocks?: string[]
    tables?: string[]
  }
  user_activity?: {
    scroll_position: number
    window_size: { width: number; height: number }
    focused_element?: string
    time_on_page?: number
    interaction_count?: number
  }
  content_quality?: {
    word_count: number
    has_images: boolean
    has_code: boolean
    has_tables: boolean
    readability_score?: number
  }
}
