// Lazy loader for the Razorpay Checkout JS bundle.
// Razorpay does not expose an npm package for the client SDK — the official
// approach is to inject their script tag and use `window.Razorpay`.

let loadPromise: Promise<void> | null = null

export function loadRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Razorpay) return Promise.resolve()
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Razorpay = (window as any).Razorpay
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
