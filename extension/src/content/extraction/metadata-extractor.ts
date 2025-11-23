import { sanitizeText } from '@/utils/text'

export function extractContentSummary(): string {
  const title = sanitizeText(document.title)
  const metaDescription = sanitizeText(
    document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  )
  const ogDescription = sanitizeText(
    document.querySelector('meta[property="og:description"]')?.getAttribute('content') || ''
  )
  const twitterDescription = sanitizeText(
    document.querySelector('meta[name="twitter:description"]')?.getAttribute('content') || ''
  )
  const mainHeading = sanitizeText(
    document.querySelector('h1')?.textContent?.trim() ||
      document.querySelector('h2')?.textContent?.trim() ||
      document.querySelector('h3')?.textContent?.trim() ||
      ''
  )
  const paragraphs = Array.from(document.querySelectorAll('p'))
    .map(p => sanitizeText(p.textContent?.trim() || ''))
    .filter(text => text && text.length > 50)
  const firstParagraph = paragraphs[0] || ''
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map(h => sanitizeText(h.textContent?.trim() || ''))
    .filter(text => text && text.length > 0 && text.length < 100)
    .slice(0, 3)
  const summaryParts = [
    title,
    metaDescription || ogDescription || twitterDescription,
    mainHeading,
    firstParagraph,
    ...headings,
  ].filter(text => text && text.length > 0)
  return sanitizeText(summaryParts.join(' | ').substring(0, 800))
}

export function extractContentType(): string {
  const url = window.location.href
  const title = document.title.toLowerCase()
  if (url.includes('/blog/') || url.includes('/post/') || title.includes('blog')) return 'blog_post'
  if (url.includes('/docs/') || url.includes('/documentation/') || title.includes('docs'))
    return 'documentation'
  if (
    url.includes('/tutorial/') ||
    url.includes('/guide/') ||
    title.includes('tutorial') ||
    title.includes('guide')
  )
    return 'tutorial'
  if (url.includes('/news/') || title.includes('news')) return 'news_article'
  if (url.includes('/product/') || title.includes('product')) return 'product_page'
  if (url.includes('/about/') || title.includes('about')) return 'about_page'
  if (url.includes('/contact/') || title.includes('contact')) return 'contact_page'
  if (url.includes('/search') || title.includes('search')) return 'search_results'
  if (url.includes('/forum/') || url.includes('/discussion/')) return 'forum_post'
  if (url.includes('/github.com/') || url.includes('/gitlab.com/')) return 'code_repository'
  if (url.includes('/stackoverflow.com/') || url.includes('/stackexchange.com/')) return 'qa_thread'
  if (url.includes('/youtube.com/') || url.includes('/vimeo.com/')) return 'video_content'
  if (url.includes('/twitter.com/') || url.includes('/x.com/')) return 'social_media'
  if (url.includes('/reddit.com/')) return 'reddit_post'
  if (url.includes('/medium.com/') || url.includes('/substack.com/')) return 'article'
  return 'web_page'
}

export function extractKeyTopics(): string[] {
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map(h => h.textContent?.trim())
    .filter(text => text && text.length > 0 && text.length < 100)
    .slice(0, 8)
  const metaKeywords =
    document
      .querySelector('meta[name="keywords"]')
      ?.getAttribute('content')
      ?.split(',')
      .map(k => k.trim()) || []
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''
  const ogKeywords =
    document
      .querySelector('meta[property="og:keywords"]')
      ?.getAttribute('content')
      ?.split(',')
      .map(k => k.trim()) || []
  const twitterTitle =
    document.querySelector('meta[name="twitter:title"]')?.getAttribute('content') || ''
  const twitterKeywords =
    document
      .querySelector('meta[name="twitter:keywords"]')
      ?.getAttribute('content')
      ?.split(',')
      .map(k => k.trim()) || []
  const structuredData = extractStructuredDataTopics()
  const urlTopics = extractUrlTopics()
  const allTopics = [
    ...headings,
    ...metaKeywords,
    ...ogKeywords,
    ...twitterKeywords,
    ...structuredData,
    ...urlTopics,
    ogTitle,
    twitterTitle,
  ].filter(topic => topic && topic.length > 2 && topic.length < 50)
  return [...new Set(allTopics)].slice(0, 20)
}

function extractStructuredDataTopics(): string[] {
  const topics: string[] = []
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]')
    scripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent || '')
        if (data['@type'] && data.name) {
          topics.push(data.name)
        }
        if (data.keywords) {
          if (Array.isArray(data.keywords)) {
            topics.push(...data.keywords)
          } else if (typeof data.keywords === 'string') {
            topics.push(...data.keywords.split(',').map((k: string) => k.trim()))
          }
        }
        if (data.about) {
          if (Array.isArray(data.about)) {
            topics.push(...data.about.map((item: any) => item.name || item))
          } else if (typeof data.about === 'string') {
            topics.push(data.about)
          }
        }
      } catch (_e) {}
    })
  } catch (_e) {}
  return topics
}

function extractUrlTopics(): string[] {
  const _url = window.location.href
  const pathname = window.location.pathname
  const segments = pathname
    .split('/')
    .filter(segment => segment && segment.length > 2 && segment.length < 30)
    .filter(segment => !/^\d+$/.test(segment))
    .filter(segment => !/^(page|p|id|slug|post|article)$/i.test(segment))
  const domain = window.location.hostname
  const domainTopics: string[] = []
  if (domain.includes('github.com')) {
    domainTopics.push('programming', 'code', 'repository')
  } else if (domain.includes('stackoverflow.com') || domain.includes('stackexchange.com')) {
    domainTopics.push('programming', 'question', 'answer')
  } else if (domain.includes('medium.com') || domain.includes('substack.com')) {
    domainTopics.push('article', 'blog', 'writing')
  } else if (domain.includes('youtube.com')) {
    domainTopics.push('video', 'tutorial', 'education')
  } else if (domain.includes('reddit.com')) {
    domainTopics.push('discussion', 'community', 'reddit')
  } else if (domain.includes('wikipedia.org')) {
    domainTopics.push('encyclopedia', 'reference', 'information')
  }
  return [...segments, ...domainTopics]
}

import { extractMeaningfulContent } from './text-extractor'

export function extractReadingTime(): number {
  const content = extractMeaningfulContent()
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}

export function extractPageMetadata() {
  const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement
  const keywords = document.querySelector('meta[name="keywords"]') as HTMLMetaElement
  const author = document.querySelector('meta[name="author"]') as HTMLMetaElement
  const viewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement
  const published = document.querySelector(
    'meta[property="article:published_time"]'
  ) as HTMLMetaElement
  const modified = document.querySelector(
    'meta[property="article:modified_time"]'
  ) as HTMLMetaElement
  const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
  return {
    description: meta?.content || '',
    keywords: keywords?.content || '',
    author: author?.content || '',
    viewport: viewport?.content || '',
    language: document.documentElement.lang || '',
    published_date: published?.content || '',
    modified_date: modified?.content || '',
    canonical_url: canonical?.href || '',
  }
}
