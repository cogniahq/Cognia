/// <reference types="vite/client" />

interface ImportMeta {
  env: {
    VITE_SERVER_URL: string
    VITE_DEV_HOST: string
    VITE_DEV_PORT: number
    VITE_FIREBASE_API_KEY: string
    VITE_FIREBASE_AUTH_DOMAIN: string
    VITE_FIREBASE_PROJECT_ID: string
    VITE_FIREBASE_STORAGE_BUCKET: string
    VITE_FIREBASE_MESSAGING_SENDER_ID: string
    VITE_FIREBASE_APP_ID: string
    VITE_FIREBASE_MEASUREMENT_ID: string
    VITE_RAZORPAY_PLAN_PRO?: string
    VITE_RAZORPAY_PLAN_ENTERPRISE?: string
    DEV: boolean
  }
}

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        id?: string
        sendMessage?: (
          extensionId: string,
          message: { type: string; [key: string]: unknown }
        ) => Promise<void>
      }
    }
  }
}
