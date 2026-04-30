import { useEffect, useRef, useState } from "react"
import { identityService } from "@/services/identity.service"
import { useNavigate, useSearchParams } from "react-router-dom"

import { LoadingSpinner } from "@/components/ui/loading-spinner"

type VerifyState = "loading" | "success" | "error" | "missing"

export function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<VerifyState>("loading")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const token = searchParams.get("token")
    if (!token) {
      setState("missing")
      return
    }

    const run = async () => {
      try {
        await identityService.verifyEmail(token)
        setState("success")
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Verification failed"
        )
        setState("error")
      }
    }
    void run()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="max-w-md w-full bg-white border border-gray-200 p-8 shadow-sm">
        <div className="text-center space-y-4">
          <div className="mx-auto w-12 h-12 flex items-center justify-center">
            <img
              src="/black-transparent.png"
              alt="Cognia"
              className="w-12 h-12"
            />
          </div>

          {state === "loading" && (
            <>
              <h1 className="text-xl font-light font-editorial text-gray-900">
                Verifying your email...
              </h1>
              <div className="flex items-center justify-center pt-2">
                <LoadingSpinner size="md" />
              </div>
            </>
          )}

          {state === "success" && (
            <>
              <h1 className="text-2xl font-light font-editorial text-gray-900">
                Email verified
              </h1>
              <p className="text-sm text-gray-600">
                Thanks for confirming your address. You can now use every
                workspace feature.
              </p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="mt-4 inline-flex w-full items-center justify-center rounded-none px-4 py-2 bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black text-sm font-medium transition-colors"
              >
                Continue
              </button>
            </>
          )}

          {state === "error" && (
            <>
              <h1 className="text-2xl font-light font-editorial text-gray-900">
                Verification failed
              </h1>
              <p className="text-sm text-red-700">
                {errorMessage ||
                  "This link is invalid or expired. Request a new one from your account settings."}
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-4 inline-flex w-full items-center justify-center rounded-none px-4 py-2 bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black text-sm font-medium transition-colors"
              >
                Back to sign in
              </button>
            </>
          )}

          {state === "missing" && (
            <>
              <h1 className="text-2xl font-light font-editorial text-gray-900">
                Missing token
              </h1>
              <p className="text-sm text-gray-600">
                This URL doesn't include a verification token. Use the link from
                your email.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-4 inline-flex w-full items-center justify-center rounded-none px-4 py-2 bg-gray-100 border border-gray-300 text-black hover:bg-black hover:text-white hover:border-black text-sm font-medium transition-colors"
              >
                Back to sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default VerifyEmail
