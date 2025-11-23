import type { AIChatPlatform } from '@/types'

let currentPlatform: AIChatPlatform = 'none'

export function detectAIChatPlatform(): AIChatPlatform {
  const hostname = window.location.hostname

  if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) {
    return 'chatgpt'
  }

  if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) {
    return 'claude'
  }

  return 'none'
}

export function getCurrentPlatform(): AIChatPlatform {
  return currentPlatform
}

export function setCurrentPlatform(platform: AIChatPlatform) {
  currentPlatform = platform
}
