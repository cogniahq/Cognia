let privacyExtensionDetected = false
let privacyExtensionType = 'unknown'

export function detectPrivacyExtensions(): void {
  try {
    const _privacyExtensions = [
      'uBlock Origin',
      'AdBlock Plus',
      'Ghostery',
      'Privacy Badger',
      'DuckDuckGo Privacy Essentials',
      'Brave Shields',
      'AdGuard',
      'NoScript',
      'ScriptSafe',
      'uMatrix',
    ]
    const hasAdBlockers =
      document.querySelectorAll(
        '[id*="adblock"], [class*="adblock"], [id*="ublock"], [class*="ublock"]'
      ).length > 0
    const hasPrivacyElements =
      document.querySelectorAll(
        '[id*="privacy"], [class*="privacy"], [id*="ghostery"], [class*="ghostery"]'
      ).length > 0
    if (hasAdBlockers || hasPrivacyElements) {
      privacyExtensionDetected = true
      privacyExtensionType = 'adblocker'
    }
    if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
      privacyExtensionDetected = true
      privacyExtensionType = 'csp'
    }
    try {
      const testIframe = document.createElement('iframe')
      testIframe.style.display = 'none'
      document.body.appendChild(testIframe)
      document.body.removeChild(testIframe)
    } catch (_error) {
      privacyExtensionDetected = true
      privacyExtensionType = 'iframe_restriction'
    }
  } catch (_error) {}
}

export function getPrivacyExtensionInfo() {
  return {
    detected: privacyExtensionDetected,
    type: privacyExtensionType,
    compatibility_mode: privacyExtensionDetected,
  }
}
