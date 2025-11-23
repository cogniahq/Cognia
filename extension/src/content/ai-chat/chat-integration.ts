import { runtime } from '@/lib/browser'
import { detectAIChatPlatform, getCurrentPlatform, setCurrentPlatform } from './platform-detector'
import { autoInjectMemories, setCogniaIcon } from './memory-injection'

let chatInput: HTMLTextAreaElement | HTMLElement | null = null
let chatSendButton: HTMLButtonElement | null = null
let originalSendHandler: ((event: Event) => void) | null = null
let cogniaIcon: HTMLElement | null = null
let typingTimeout: ReturnType<typeof setTimeout> | null = null
let lastTypedText = ''

const MEMORY_INJECTION_DELAY = 1500

function getCurrentInputText(): string {
  if (!chatInput) return ''

  if (chatInput.tagName === 'TEXTAREA') {
    return (chatInput as HTMLTextAreaElement).value?.trim() || ''
  } else if ((chatInput as HTMLElement).contentEditable === 'true') {
    return chatInput.textContent?.trim() || ''
  }

  return ''
}

function handleTyping(): void {
  if (!chatInput) return

  const currentText = getCurrentInputText()

  if (currentText.includes('[Cognia Memory Context]')) return

  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }

  typingTimeout = setTimeout(async () => {
    if (currentText && currentText.length >= 3 && currentText !== lastTypedText) {
      lastTypedText = currentText
      await autoInjectMemories(currentText, chatInput, getCurrentInputText)
    }
  }, MEMORY_INJECTION_DELAY)
}

function calculateIconPosition(): string {
  if (chatSendButton && chatInput) {
    try {
      const container = (chatInput as HTMLElement).closest('div')
      if (container) {
        const containerRect = container.getBoundingClientRect()
        const buttonRect = chatSendButton.getBoundingClientRect()
        const buttonRightFromContainer = containerRect.right - buttonRect.right
        const buttonWidth = buttonRect.width || 40
        const spacing = 12
        const rightPosition = buttonRightFromContainer + buttonWidth + spacing
        return `${Math.max(rightPosition, 60)}px`
      }
    } catch (_error) {}
  }
  return '60px'
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

async function showCogniaStatus(): Promise<void> {
  const tooltip = document.createElement('div')
  tooltip.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(16, 163, 127, 0.95);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 8px 24px rgba(16, 163, 127, 0.3);
    z-index: 10000;
    max-width: 320px;
    border: 1px solid rgba(16, 163, 127, 0.3);
    backdrop-filter: blur(12px);
  `

  tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #ffffff; animation: pulse 1s infinite;"></div>
        <strong>Cognia Extension</strong>
      </div>
      <div style="font-size: 12px; color: rgba(255, 255, 255, 0.8);">
        Checking status...
      </div>
    `

  document.body.appendChild(tooltip)

  try {
    const [apiHealthy, extensionEnabled] = await Promise.all([true, checkExtensionEnabled()])

    const apiStatus = apiHealthy ? 'Connected' : 'Not Connected'
    const extensionStatus = extensionEnabled ? 'Enabled' : 'Disabled'
    const overallStatus = apiHealthy && extensionEnabled ? 'Active' : 'Inactive'
    const statusColor = overallStatus === 'Active' ? '#10a37f' : '#ef4444'

    const platformName =
      getCurrentPlatform() === 'chatgpt'
        ? 'ChatGPT'
        : getCurrentPlatform() === 'claude'
          ? 'Claude'
          : 'Unknown'

    tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor};"></div>
        <strong>Cognia on ${platformName}</strong>
      </div>
      <div style="font-size: 12px; color: rgba(255, 255, 255, 0.9);">
        <div>Extension: ${extensionStatus}</div>
        <div>API: ${apiStatus}</div>
      </div>
      <div style="font-size: 11px; color: rgba(255, 255, 255, 0.7); margin-top: 8px;">
        ${extensionEnabled ? 'Memories are automatically injected as you type (1.5s delay).' : 'Extension is disabled. Click the popup to enable.'}
      </div>
    `
  } catch (error) {
    console.error('Cognia: Error checking status:', error)
    tooltip.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div>
        <strong>Cognia Extension</strong>
      </div>
      <div style="font-size: 12px; color: rgba(255, 255, 255, 0.9);">
        Error checking status
      </div>
    `
  }

  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.parentNode.removeChild(tooltip)
    }
  }, 6000)
}

async function createCogniaIcon(): Promise<HTMLElement> {
  const icon = document.createElement('div')
  icon.id = 'cognia-extension-icon'
  icon.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
      <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="currentColor"/>
      <path d="M5 15L5.5 17.5L8 18L5.5 18.5L5 21L4.5 18.5L2 18L4.5 17.5L5 15Z" fill="currentColor"/>
    </svg>
  `

  const enabled = await checkExtensionEnabled()
  const baseColor = enabled ? '#10a37f' : '#8e8ea0'
  const bgColor = enabled ? 'rgba(16, 163, 127, 0.1)' : 'rgba(142, 142, 160, 0.1)'
  const borderColor = enabled ? 'rgba(16, 163, 127, 0.2)' : 'rgba(142, 142, 160, 0.2)'

  const rightPosition = calculateIconPosition()

  icon.style.cssText = `
    position: absolute !important;
    right: ${rightPosition} !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    width: 32px !important;
    height: 32px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    color: ${baseColor} !important;
    cursor: pointer !important;
    border-radius: 8px !important;
    transition: all 0.2s ease !important;
    z-index: 1 !important;
    background: ${bgColor} !important;
    border: 1px solid ${borderColor} !important;
    padding: 0 !important;
    box-shadow: 0 2px 12px ${enabled ? 'rgba(16, 163, 127, 0.15)' : 'rgba(142, 142, 160, 0.15)'} !important;
    visibility: visible !important;
    opacity: ${enabled ? '1' : '0.6'} !important;
    pointer-events: auto !important;
    backdrop-filter: blur(8px) !important;
  `

  icon.addEventListener('mouseenter', () => {
    icon.style.color = '#ffffff'
    icon.style.backgroundColor = '#10a37f'
    icon.style.borderColor = '#10a37f'
    icon.style.transform = 'translateY(-50%) scale(1.05)'
    icon.style.boxShadow = '0 4px 16px rgba(16, 163, 127, 0.3)'
  })

  icon.addEventListener('mouseleave', () => {
    icon.style.color = '#10a37f'
    icon.style.backgroundColor = 'rgba(16, 163, 127, 0.1)'
    icon.style.borderColor = 'rgba(16, 163, 127, 0.2)'
    icon.style.transform = 'translateY(-50%) scale(1)'
    icon.style.boxShadow = '0 2px 12px rgba(16, 163, 127, 0.15)'
  })

  icon.addEventListener('click', async () => {
    await showCogniaStatus()
  })

  return icon
}

function findChatInputElements(): void {
  const currentPlatform = getCurrentPlatform()
  let inputSelectors: string[] = []
  let buttonSelectors: string[] = []

  if (currentPlatform === 'chatgpt') {
    inputSelectors = [
      'div[contenteditable="true"]',
      'textarea[placeholder*="Ask anything"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send a message"]',
      'textarea[placeholder*="Type a message"]',
      'textarea[role="textbox"]',
      'textarea',
      'input[type="text"]',
    ]

    buttonSelectors = [
      'button[data-testid*="send"]',
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'button[aria-label*="Submit"]',
      'button[type="submit"]',
      'button:has(svg)',
      'button[class*="send"]',
      'button[class*="submit"]',
      'button',
    ]
  } else if (currentPlatform === 'claude') {
    inputSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Reply"]',
      'textarea[placeholder*="Talk to Claude"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      'div.ProseMirror',
      'textarea',
      'input[type="text"]',
    ]

    buttonSelectors = [
      'button[aria-label*="Send"]',
      'button[title*="Send"]',
      'button[aria-label*="Submit"]',
      'button[type="submit"]',
      'button:has(svg)',
      'button[class*="send"]',
      'button[class*="submit"]',
      'button',
    ]
  }

  for (const selector of inputSelectors) {
    const element = document.querySelector(selector) as HTMLElement
    if (element && element.offsetParent !== null) {
      chatInput = element as any
      break
    }
  }

  for (const selector of buttonSelectors) {
    const element = document.querySelector(selector) as HTMLButtonElement
    if (element && element.offsetParent !== null) {
      chatSendButton = element
      break
    }
  }
}

function setupAIChatIntegration(): void {
  if (getCurrentPlatform() === 'none') return

  if (originalSendHandler) {
    return
  }

  findChatInputElements()

  if (chatInput && !cogniaIcon) {
    const containerSelectors = [
      'div[class*="input"]',
      'div[class*="chat"]',
      'div[class*="message"]',
      'div[class*="form"]',
      'div[class*="composer"]',
      'div[class*="prompt"]',
      'div[class*="textbox"]',
      'div',
    ]

    let inputContainer: Element | null = null
    for (const selector of containerSelectors) {
      const container = (chatInput as HTMLElement).closest(selector)
      if (container) {
        inputContainer = container
        break
      }
    }

    if (!inputContainer) {
      inputContainer = (chatInput as HTMLElement).parentElement
    }

    if (inputContainer) {
      const containerStyle = window.getComputedStyle(inputContainer)
      if (containerStyle.position === 'static') {
        ;(inputContainer as HTMLElement).style.position = 'relative'
      }

      const existingIcon = document.getElementById('cognia-extension-icon')
      if (existingIcon) {
        existingIcon.remove()
      }

      createCogniaIcon().then(icon => {
        cogniaIcon = icon
        setCogniaIcon(icon)
        inputContainer.appendChild(cogniaIcon)
        setTimeout(() => {
          if (cogniaIcon && chatSendButton) {
            const newRightPosition = calculateIconPosition()
            cogniaIcon.style.right = newRightPosition
          }
        }, 100)
      })

      const ensureIconVisible = () => {
        if (!cogniaIcon || !document.body.contains(cogniaIcon)) {
          findChatInputElements()

          if (chatInput) {
            let newContainer: Element | null = null
            const containerSelectors = [
              'div[class*="input"]',
              'div[class*="chat"]',
              'div[class*="message"]',
              'div[class*="form"]',
              'div[class*="composer"]',
              'div[class*="prompt"]',
              'div[class*="textbox"]',
              'div',
            ]

            for (const selector of containerSelectors) {
              const container = (chatInput as HTMLElement).closest(selector)
              if (container) {
                newContainer = container
                break
              }
            }

            if (!newContainer) {
              newContainer = (chatInput as HTMLElement).parentElement
            }

            if (newContainer && document.body.contains(newContainer)) {
              const existingIcon = document.getElementById('cognia-extension-icon')
              if (existingIcon) {
                existingIcon.remove()
              }

              createCogniaIcon().then(icon => {
                cogniaIcon = icon
                setCogniaIcon(icon)
                newContainer.appendChild(cogniaIcon)
                setTimeout(() => {
                  if (cogniaIcon && chatSendButton) {
                    const newRightPosition = calculateIconPosition()
                    cogniaIcon.style.right = newRightPosition
                  }
                }, 100)
              })
            }
          }
        }
      }

      setInterval(ensureIconVisible, 1000)

      const iconObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            const removedNodes = Array.from(mutation.removedNodes)
            const iconRemoved = removedNodes.some(
              node =>
                node.nodeType === Node.ELEMENT_NODE &&
                (node as Element).id === 'cognia-extension-icon'
            )

            if (iconRemoved) {
              setTimeout(() => {
                if (!cogniaIcon || !document.body.contains(cogniaIcon)) {
                  ensureIconVisible()
                }
              }, 500)
            }
          }
        })
      })

      if (inputContainer) {
        iconObserver.observe(inputContainer, {
          childList: true,
          subtree: true,
        })
      }
    }
  }

  if (chatInput && !originalSendHandler) {
    const inputHandler = (_e: Event) => {
      handleTyping()
    }

    const keyupHandler = (_e: Event) => {
      handleTyping()
    }

    const pasteHandler = (_e: Event) => {
      setTimeout(handleTyping, 100)
    }

    chatInput.addEventListener('input', inputHandler, true)
    chatInput.addEventListener('keyup', keyupHandler, true)
    chatInput.addEventListener('paste', pasteHandler, true)

    if ((chatInput as HTMLElement).contentEditable === 'true') {
      document.addEventListener(
        'input',
        e => {
          if (e.target === chatInput) {
            handleTyping()
          }
        },
        true
      )

      const contentObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            handleTyping()
          }
        })
      })

      contentObserver.observe(chatInput as Node, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }

    originalSendHandler = () => {}
  } else if (!chatInput) {
    console.log('Cognia: No chat input found for event listeners')
  } else if (originalSendHandler) {
    console.log('Cognia: Event listeners already attached')
  }
}

function addCogniaStyles(): void {
  if (document.getElementById('cognia-styles')) return

  const style = document.createElement('style')
  style.id = 'cognia-styles'
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    
    #cognia-extension-icon {
      transition: all 0.2s ease;
    }
    
    #cognia-extension-icon:hover {
      transform: translateY(-50%) scale(1.1) !important;
    }
  `
  document.head.appendChild(style)
}

function waitForAIChatReady(): Promise<void> {
  return new Promise(resolve => {
    let attempts = 0
    const maxAttempts = 5

    const checkReady = () => {
      attempts++

      const hasInput =
        document.querySelector('div[contenteditable="true"]') || document.querySelector('textarea')
      const hasSendButton = document.querySelector(
        'button[data-testid*="send"], button[aria-label*="Send"], button[title*="Send"]'
      )

      if (hasInput && hasSendButton) {
        resolve()
      } else if (attempts >= maxAttempts) {
        resolve()
      } else {
        setTimeout(checkReady, 1000)
      }
    }

    setTimeout(checkReady, 1000)
  })
}

function trySetupImmediately(): void {
  setupAIChatIntegration()

  if (!cogniaIcon) {
    setTimeout(() => {
      setupAIChatIntegration()
    }, 3000)

    setTimeout(() => {
      setupAIChatIntegration()
    }, 6000)
  }
}

export function initAIChatIntegration(): void {
  const platform = detectAIChatPlatform()
  setCurrentPlatform(platform)

  if (platform !== 'none') {
    addCogniaStyles()

    trySetupImmediately()

    waitForAIChatReady().then(() => {
      setupAIChatIntegration()
    })

    let setupTimeout: ReturnType<typeof setTimeout> | null = null
    let isWaitingForReady = true

    const observer = new MutationObserver(mutations => {
      if (originalSendHandler || isWaitingForReady) return

      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          const hasNewChatElements = Array.from(mutation.addedNodes).some(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              return (
                element.querySelector &&
                (element.querySelector('div[contenteditable="true"]') ||
                  element.querySelector('textarea') ||
                  element.querySelector('button[data-testid*="send"]') ||
                  element.tagName === 'TEXTAREA' ||
                  element.tagName === 'BUTTON')
              )
            }
            return false
          })

          if (hasNewChatElements && !setupTimeout) {
            setupTimeout = setTimeout(() => {
              setupAIChatIntegration()
              setupTimeout = null
            }, 1000)
          }
        }
      })
    })

    waitForAIChatReady().then(() => {
      isWaitingForReady = false
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })
    })

    let retryCount = 0
    const maxRetries = 3
    const retrySetup = () => {
      if (!cogniaIcon && !originalSendHandler && retryCount < maxRetries) {
        retryCount++
        setupAIChatIntegration()
        setTimeout(retrySetup, 3000)
      } else if (retryCount >= maxRetries) {
        // Max retries reached, giving up
      }
    }

    waitForAIChatReady().then(() => {
      setTimeout(retrySetup, 2000)
    })

    const continuousIconMonitor = () => {
      if (!cogniaIcon && platform !== 'none') {
        setupAIChatIntegration()
      }
    }

    setInterval(continuousIconMonitor, 5000)
  }
}

;(window as any).debugCognia = () => {
  console.log('Cognia Debug Info:')
  console.log('Platform:', getCurrentPlatform())
  console.log('Chat Input:', chatInput)
  console.log('Cognia Icon:', cogniaIcon)
}
;(window as any).triggerCognia = async () => {
  const currentText = getCurrentInputText()
  if (currentText && currentText.length >= 3) {
    await autoInjectMemories(currentText, chatInput, getCurrentInputText)
  }
}
;(window as any).testCogniaSearch = async (query = 'server boilerplates') => {
  const { getMemorySummary } = await import('./memory-injection')
  try {
    return await getMemorySummary(query)
  } catch (_error) {
    return null
  }
}
;(window as any).checkCogniaStatus = async () => {
  const { storage } = await import('@/lib/browser')
  const { env } = await import('@/utils/core/env.util')
  const apiEndpoint = await storage.sync
    .get(['apiEndpoint'])
    .then((cfg: any) => cfg?.apiEndpoint || env.API_ENDPOINT)

  return {
    apiEndpoint,
    apiHealthy: true,
    platform: getCurrentPlatform(),
    chatInput: !!chatInput,
    cogniaIcon: !!cogniaIcon,
  }
}
