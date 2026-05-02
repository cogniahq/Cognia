/* eslint-disable @typescript-eslint/no-explicit-any */
declare const browser: typeof chrome | undefined

type BrowserName = 'chrome' | 'firefox' | 'unknown'

function detectBrowser(): BrowserName {
  if (
    typeof browser !== 'undefined' &&
    browser?.runtime &&
    (browser.runtime as any).getBrowserInfo
  ) {
    return 'firefox'
  }
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return 'chrome'
  }
  return 'unknown'
}

const browserName = detectBrowser()

const browserAPI = (
  typeof browser !== 'undefined' && browser?.runtime ? browser : chrome
) as typeof chrome

export const isFirefox = browserName === 'firefox'
export const isChrome = browserName === 'chrome'

export const storage = {
  sync: {
    get: (
      keys: string | string[] | { [key: string]: any } | null
    ): Promise<{ [key: string]: any }> => {
      if (isFirefox) {
        return browserAPI.storage.sync.get(keys)
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.sync.get(keys, (result: { [key: string]: any }) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      })
    },
    set: (items: { [key: string]: any }): Promise<void> => {
      if (isFirefox) {
        return browserAPI.storage.sync.set(items)
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.sync.set(items, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    },
    remove: (keys: string | string[]): Promise<void> => {
      if (isFirefox) {
        return browserAPI.storage.sync.remove(keys)
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.sync.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    },
  },
  local: {
    get: (
      keys: string | string[] | { [key: string]: any } | null
    ): Promise<{ [key: string]: any }> => {
      if (isFirefox) {
        return browserAPI.storage.local.get(keys)
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.get(keys, (result: { [key: string]: any }) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      })
    },
    set: (items: { [key: string]: any }): Promise<void> => {
      if (isFirefox) {
        return browserAPI.storage.local.set(items)
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.set(items, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    },
    remove: (keys: string | string[]): Promise<void> => {
      if (isFirefox) {
        return browserAPI.storage.local.remove(keys)
      }
      return new Promise((resolve, reject) => {
        browserAPI.storage.local.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    },
  },
  // chrome.storage.session is in-memory and cleared when the browser closes.
  // Firefox added support in a recent release; we feature-detect and fall
  // back to the same surface so callers don't need to special-case it.
  session: {
    get: (
      keys: string | string[] | { [key: string]: any } | null
    ): Promise<{ [key: string]: any }> => {
      const sessionApi = (browserAPI.storage as unknown as { session?: chrome.storage.SessionStorageArea })
        .session
      if (!sessionApi) return Promise.resolve({})
      if (isFirefox) {
        return (sessionApi.get as (k: typeof keys) => Promise<{ [key: string]: any }>)(keys)
      }
      return new Promise((resolve, reject) => {
        sessionApi.get(keys, (result: { [key: string]: any }) => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve(result)
          }
        })
      })
    },
    set: (items: { [key: string]: any }): Promise<void> => {
      const sessionApi = (browserAPI.storage as unknown as { session?: chrome.storage.SessionStorageArea })
        .session
      if (!sessionApi) return Promise.resolve()
      if (isFirefox) {
        return (sessionApi.set as (i: typeof items) => Promise<void>)(items)
      }
      return new Promise((resolve, reject) => {
        sessionApi.set(items, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    },
    remove: (keys: string | string[]): Promise<void> => {
      const sessionApi = (browserAPI.storage as unknown as { session?: chrome.storage.SessionStorageArea })
        .session
      if (!sessionApi) return Promise.resolve()
      if (isFirefox) {
        return (sessionApi.remove as (k: typeof keys) => Promise<void>)(keys)
      }
      return new Promise((resolve, reject) => {
        sessionApi.remove(keys, () => {
          if (browserAPI.runtime.lastError) {
            reject(new Error(browserAPI.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })
    },
  },
}

export const runtime = {
  id: browserAPI.runtime.id,
  onInstalled: browserAPI.runtime.onInstalled,
  onMessage: browserAPI.runtime.onMessage,
  sendMessage: <T = any>(message: any, responseCallback?: (response: T) => void): void => {
    if (isFirefox) {
      if (responseCallback) {
        browserAPI.runtime
          .sendMessage(message)
          .then(responseCallback)
          .catch(() => {})
      } else {
        browserAPI.runtime.sendMessage(message).catch(() => {})
      }
    } else {
      browserAPI.runtime.sendMessage(message, responseCallback)
    }
  },
  lastError: isFirefox ? undefined : browserAPI.runtime.lastError,
}

export const tabs = {
  query: (queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => {
    if (!browserAPI.tabs) {
      return Promise.reject(new Error('Tabs API not available'))
    }
    if (isFirefox) {
      return browserAPI.tabs.query(queryInfo) as Promise<chrome.tabs.Tab[]>
    }
    return new Promise((resolve, reject) => {
      browserAPI.tabs.query(queryInfo, (tabs: chrome.tabs.Tab[]) => {
        if (browserAPI.runtime.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message))
        } else {
          resolve(tabs)
        }
      })
    })
  },
  sendMessage: (tabId: number, message: any, responseCallback?: (response: any) => void): void => {
    if (!browserAPI.tabs) {
      return
    }
    if (isFirefox) {
      if (responseCallback) {
        browserAPI.tabs
          .sendMessage(tabId, message)
          .then(responseCallback)
          .catch(() => {})
      } else {
        browserAPI.tabs.sendMessage(tabId, message).catch(() => {})
      }
    } else {
      try {
        if (responseCallback) {
          browserAPI.tabs.sendMessage(tabId, message, response => {
            if (browserAPI.runtime.lastError) {
              return
            }
            responseCallback(response)
          })
        } else {
          browserAPI.tabs.sendMessage(tabId, message, () => {
            if (browserAPI.runtime.lastError) {
              return
            }
          })
        }
      } catch (_error) {}
    }
  },
  get onActivated() {
    return browserAPI.tabs?.onActivated
  },
  get onUpdated() {
    return browserAPI.tabs?.onUpdated
  },
}

export const cookies = {
  get: (details: { url: string; name: string }): Promise<chrome.cookies.Cookie | null> => {
    if (isFirefox) {
      return browserAPI.cookies.get(details) as Promise<chrome.cookies.Cookie | null>
    }
    return new Promise((resolve, reject) => {
      browserAPI.cookies.get(details, (cookie: chrome.cookies.Cookie | null) => {
        if (browserAPI.runtime.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message))
        } else {
          resolve(cookie || null)
        }
      })
    })
  },
  getAll: (details?: chrome.cookies.GetAllDetails): Promise<chrome.cookies.Cookie[]> => {
    if (isFirefox) {
      return browserAPI.cookies.getAll(details || {}) as Promise<chrome.cookies.Cookie[]>
    }
    return new Promise((resolve, reject) => {
      browserAPI.cookies.getAll(details || {}, (cookies: chrome.cookies.Cookie[]) => {
        if (browserAPI.runtime.lastError) {
          reject(new Error(browserAPI.runtime.lastError.message))
        } else {
          resolve(cookies || [])
        }
      })
    })
  },
}

export default {
  storage,
  runtime,
  tabs,
  cookies,
  isFirefox,
  isChrome,
}
