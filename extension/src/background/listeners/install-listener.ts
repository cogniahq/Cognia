import { runtime } from '@/lib/browser'

export function setupInstallListener(): void {
  runtime.onInstalled.addListener(() => {
    // Installation logic can be added here if needed
  })
}
