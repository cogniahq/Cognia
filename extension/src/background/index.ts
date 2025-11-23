import { runtime } from '@/lib/browser'
import { handleMessage } from './handlers/message-handler'
import { setupTabListeners } from './listeners/tab-listener'
import { setupInstallListener } from './listeners/install-listener'

setupInstallListener()
setupTabListeners()

runtime.onMessage.addListener(handleMessage)
