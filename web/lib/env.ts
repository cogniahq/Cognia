/**
 * Centralised environment access. Server-only vars stay typed as `string`
 * (we throw if missing at boot). Public vars are nullable since they may
 * legitimately be unset (e.g., Razorpay plan ids in dev).
 *
 * Server-only fields must NOT be referenced from "use client" files.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  // Public (must be NEXT_PUBLIC_* to be inlined into client bundles).
  publicApiUrl: required("NEXT_PUBLIC_API_URL"),
  razorpayPlanPro: optional("NEXT_PUBLIC_RAZORPAY_PLAN_PRO"),
  razorpayPlanEnterprise: optional("NEXT_PUBLIC_RAZORPAY_PLAN_ENTERPRISE"),
  firebase: {
    apiKey: optional("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: optional("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: optional("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: optional("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: optional("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: optional("NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: optional("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
  },
};
