"use client"

// Lazy loader for the Razorpay Checkout JS bundle.
// Razorpay does not expose an npm package for the client SDK — the official
// approach is to inject their script tag and use `window.Razorpay`.
//
// In Next.js this could also be done via <Script src="..." /> from
// next/script, but a lazy promise-based loader keeps the call site simple
// (we only load when the user actually clicks "Upgrade") and lets us skip
// the SDK entirely on dev / SSR.

interface RazorpayConstructor {
  new (options: Record<string, unknown>): { open: () => void }
}

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

let loadPromise: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.Razorpay) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script")
    s.src = "https://checkout.razorpay.com/v1/checkout.js"
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error("Failed to load Razorpay Checkout"))
    document.head.appendChild(s)
  })
  return loadPromise
}

export interface RazorpaySubscriptionOptions {
  keyId: string
  subscriptionId: string
  name: string
  description?: string
  prefillEmail?: string
  prefillName?: string
  themeColor?: string
  onSuccess: (resp: {
    razorpay_payment_id: string
    razorpay_subscription_id: string
    razorpay_signature: string
  }) => void
  onDismiss?: () => void
}

export async function openRazorpaySubscriptionCheckout(
  opts: RazorpaySubscriptionOptions
): Promise<void> {
  await loadRazorpayCheckout()
  const Razorpay = typeof window !== "undefined" ? window.Razorpay : undefined
  if (!Razorpay) throw new Error("Razorpay Checkout did not initialise")
  const rzp = new Razorpay({
    key: opts.keyId,
    subscription_id: opts.subscriptionId,
    name: opts.name,
    description: opts.description,
    prefill: { email: opts.prefillEmail, name: opts.prefillName },
    theme: { color: opts.themeColor ?? "#0f172a" },
    handler: opts.onSuccess,
    modal: { ondismiss: opts.onDismiss },
  })
  rzp.open()
}
