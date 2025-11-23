import { storage, runtime } from '@/lib/browser'
import { getUserId, requireAuthToken } from '@/utils/auth'

let isAutoInjecting = false
let cogniaIcon: HTMLElement | null = null

export function setCogniaIcon(icon: HTMLElement | null) {
  cogniaIcon = icon
}

import { env } from '@/utils/core/env.util'

async function pollSearchJob(jobId: string): Promise<string | null> {
  try {
    let apiBase = `${env.API_BASE_URL}/api`
    try {
      const cfg = await storage.sync.get(['apiEndpoint'])
      const endpoint = cfg?.apiEndpoint as string | undefined
      if (endpoint) {
        const u = new URL(endpoint)
        apiBase = `${u.protocol}//${u.host}/api`
      }
    } catch {}
    let authToken: string
    try {
      authToken = await requireAuthToken()
    } catch (_error) {
      console.error('Cognia: Authentication required. Please log in through the web client first.')
      return null
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    }

    const response = await fetch(`${apiBase}/search/job/${jobId}`, {
      method: 'GET',
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      return null
    }

    const result = await response.json()

    if (result.status === 'completed' && result.answer) {
      return result.answer
    } else if (result.status === 'failed') {
      return null
    }

    return null
  } catch (_error) {
    return null
  }
}

export async function getMemorySummary(query: string): Promise<string | null> {
  try {
    let userId: string
    try {
      userId = await getUserId()
    } catch (_error) {
      return null
    }
    let apiBase = `${env.API_BASE_URL}/api`
    try {
      const cfg = await storage.sync.get(['apiEndpoint'])
      const endpoint = cfg?.apiEndpoint as string | undefined
      if (endpoint) {
        const u = new URL(endpoint)
        apiBase = `${u.protocol}//${u.host}/api`
      }
    } catch {}
    const searchEndpoint = `${apiBase}/search`

    const requestBody = {
      userId: userId,
      query: query,
      limit: 5,
      contextOnly: false,
    }

    let authToken: string
    try {
      authToken = await requireAuthToken()
    } catch (_error) {
      console.error('Cognia: Authentication required. Please log in through the web client first.')
      return null
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`,
    }

    const response = await fetch(searchEndpoint, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      console.error('Cognia: Search request failed:', response.status, response.statusText)
      return null
    }

    const responseText = await response.text()

    let result
    try {
      result = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Cognia: Failed to parse search response:', parseError)
      return null
    }

    let summaryParts: string[] = []

    console.log('Cognia: Search response received:', {
      hasAnswer: !!result.answer,
      hasMetaSummary: !!result.meta_summary,
      resultsCount: result.results?.length || 0,
      hasCitations: !!result.citations,
      citationsCount: result.citations?.length || 0,
      hasJobId: !!result.job_id,
    })

    if (result.answer) {
      console.log('Cognia: Using answer from response')
      summaryParts.push(result.answer)
    } else if (result.meta_summary) {
      console.log('Cognia: Using meta_summary from response')
      summaryParts.push(result.meta_summary)
    } else if (result.results && result.results.length > 0) {
      console.log('Cognia: Using results count from response')
      summaryParts.push(`Found ${result.results.length} relevant memories about "${query}".`)
    }

    if (result.citations && result.citations.length > 0) {
      const citationTexts = result.citations
        .slice(0, 6)
        .map((c: any) => `[${c.label}] ${c.title || 'Open memory'}`)
      summaryParts.push(citationTexts.join('\n'))
    }

    if (result.job_id && !result.answer) {
      for (let i = 0; i < 6; i++) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        const jobResult = await pollSearchJob(result.job_id)

        if (jobResult) {
          summaryParts = [jobResult]
          if (result.citations && result.citations.length > 0) {
            const citationTexts = result.citations
              .slice(0, 6)
              .map((c: any) => `[${c.label}] ${c.title || 'Open memory'}`)
            summaryParts.push(citationTexts.join('\n'))
          }
          break
        }
      }
    }

    if (summaryParts.length === 0) {
      console.log('Cognia: No summary parts found, returning null')
      return null
    }

    const finalSummary = summaryParts.join('\n\n')
    console.log('Cognia: Final memory summary:', finalSummary.substring(0, 200) + '...')
    return finalSummary
  } catch (error) {
    console.error('Cognia: Error in getMemorySummary:', error)
    return null
  }
}

function injectMemorySummary(
  summary: string,
  originalMessage: string,
  chatInput: HTMLElement | HTMLTextAreaElement | null
): void {
  if (!chatInput) {
    console.log('Cognia: No chat input found for injection')
    return
  }

  const combinedMessage = `[Cognia Memory Context]\n${summary}\n\n[Your Question]\n${originalMessage}`
  console.log('Cognia: Injecting combined message:', combinedMessage.substring(0, 200) + '...')

  if (chatInput.tagName === 'TEXTAREA') {
    console.log('Cognia: Injecting into textarea')
    ;(chatInput as HTMLTextAreaElement).value = combinedMessage
    const inputEvent = new Event('input', { bubbles: true })
    chatInput.dispatchEvent(inputEvent)
  } else if ((chatInput as HTMLElement).contentEditable === 'true') {
    console.log('Cognia: Injecting into contentEditable div')
    chatInput.textContent = combinedMessage
    const inputEvent = new Event('input', { bubbles: true })
    chatInput.dispatchEvent(inputEvent)
  } else {
    console.log('Cognia: Unknown input type:', chatInput.tagName, chatInput)
  }
}

async function checkExtensionEnabled(): Promise<boolean> {
  try {
    return new Promise(resolve => {
      runtime.sendMessage({ type: 'GET_EXTENSION_ENABLED' }, (response: any) => {
        resolve(response?.success ? response.enabled : true)
      })
    })
  } catch (error) {
    console.error('Cognia: Error checking extension enabled state:', error)
    return true
  }
}

async function checkMemoryInjectionEnabled(): Promise<boolean> {
  try {
    return new Promise(resolve => {
      runtime.sendMessage({ type: 'GET_MEMORY_INJECTION_ENABLED' }, (response: any) => {
        resolve(response?.success ? response.enabled : true)
      })
    })
  } catch (error) {
    console.error('Cognia: Error checking memory injection enabled state:', error)
    return true
  }
}

export async function autoInjectMemories(
  userText: string,
  chatInput: HTMLElement | HTMLTextAreaElement | null,
  getCurrentInputText: () => string
): Promise<void> {
  if (isAutoInjecting || !userText || userText.length < 3) return

  if (userText.includes('[Cognia Memory Context]')) return

  const enabled = await checkExtensionEnabled()
  if (!enabled) {
    return
  }

  const memoryInjectionEnabled = await checkMemoryInjectionEnabled()
  if (!memoryInjectionEnabled) {
    return
  }

  isAutoInjecting = true

  try {
    if (cogniaIcon) {
      cogniaIcon.style.color = '#f59e0b'
      cogniaIcon.style.animation = 'pulse 1s infinite'
    }

    const memorySummary = await getMemorySummary(userText)

    if (memorySummary) {
      const currentText = getCurrentInputText()
      console.log('Cognia: Memory found, checking text match:', {
        originalText: userText,
        currentText: currentText,
        textsMatch: currentText === userText,
        currentTextLength: currentText.length,
        originalTextLength: userText.length,
      })

      const textMatches =
        currentText === userText ||
        currentText.includes(userText) ||
        userText.includes(currentText) ||
        currentText.trim() === userText.trim()

      if (textMatches) {
        console.log('Cognia: Injecting memory summary')
        injectMemorySummary(memorySummary, userText, chatInput)

        if (cogniaIcon) {
          cogniaIcon.style.color = '#10a37f'
          cogniaIcon.style.animation = 'none'
        }
      } else {
        console.log('Cognia: Text changed during search, not injecting')
        if (cogniaIcon) {
          cogniaIcon.style.color = '#8e8ea0'
          cogniaIcon.style.animation = 'none'
        }
      }
    } else {
      if (cogniaIcon) {
        cogniaIcon.style.color = '#8e8ea0'
        cogniaIcon.style.animation = 'none'
      }
    }
  } catch (error) {
    console.error('Cognia: Error auto-injecting memories:', error)
    if (cogniaIcon) {
      cogniaIcon.style.color = '#ef4444'
      cogniaIcon.style.animation = 'none'
    }
  } finally {
    isAutoInjecting = false
    setTimeout(() => {
      if (cogniaIcon) {
        cogniaIcon.style.color = '#8e8ea0'
      }
    }, 2000)
  }
}
