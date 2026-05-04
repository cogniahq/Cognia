"use client"

import { useEffect, useRef, useState } from "react"

const ORIGINAL_EMAIL = {
  from: "Maya Patel",
  fromEmail: "maya@northwind.com",
  to: "you@cognia.io",
  subject: "Updated onboarding timeline",
  date: "Oct 15, 2:34 PM",
  body: `Hi there,

Quick heads-up on the Q4 onboarding plan. We're aiming for Nov 30 launch, but Finance tightened the budget.

Can we keep the analytics module in scope or push it to early December?`,
}

const EMAIL_DRAFT_BODY = `Hi Maya,

Thanks for the update. I reviewed our Notion onboarding plan and your Oct 12 email to verify the numbers.

We can keep the Nov 30 launch by moving the analytics module to Dec 7.`

export const EmailDraftingDemo = () => {
  const [isInView, setIsInView] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [showDraft, setShowDraft] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isInView) {
            setIsInView(true)
          }
        })
      },
      { threshold: 0.2 }
    )

    const currentContainer = containerRef.current
    if (currentContainer) {
      observer.observe(currentContainer)
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer)
      }
    }
  }, [isInView])

  useEffect(() => {
    if (!isInView) return

    const timers: ReturnType<typeof setTimeout>[] = []

    // Step 1: Email detected
    timers.push(
      setTimeout(() => {
        setActiveStep(1)
      }, 500)
    )

    // Step 2: Context gathered
    timers.push(
      setTimeout(() => {
        setActiveStep(2)
      }, 2000)
    )

    // Step 3: Draft generated
    timers.push(
      setTimeout(() => {
        setActiveStep(3)
        setShowDraft(true)
      }, 3500)
    )

    return () => {
      timers.forEach((timer) => clearTimeout(timer))
    }
  }, [isInView])

  const flowSteps = [
    {
      step: 1,
      label: "Email detected",
      description: "Cognia identifies the email thread",
    },
    {
      step: 2,
      label: "Context gathered",
      description: "Pulls relevant memories from your saved context",
    },
    {
      step: 3,
      label: "Draft generated",
      description: "Creates response grounded in email + memory context",
    },
  ]

  const showPlaceholder = activeStep < 2
  const showGenerating = activeStep >= 2 && !showDraft
  const showReady = showDraft

  const statusLabel = showDraft
    ? "Draft ready"
    : activeStep >= 2
      ? "Gathering context"
      : "Ready"

  const statusClass = showDraft
    ? "border-emerald-200 text-emerald-700 bg-emerald-50"
    : activeStep >= 2
      ? "border-blue-200 text-blue-700 bg-blue-50"
      : "border-gray-200 text-gray-500 bg-white"

  return (
    <div
      ref={containerRef}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
    >
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      {/* Flow Steps */}
      <div className="lg:col-span-1 space-y-4">
        {flowSteps.map((item, index) => {
          const isActive = activeStep >= item.step
          return (
            <div key={item.step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-medium transition-all duration-500 ${
                    isActive
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-400"
                  }`}
                >
                  {item.step}
                </div>
                {index < flowSteps.length - 1 && (
                  <div
                    className={`w-px h-12 mt-2 transition-all duration-500 ${
                      isActive ? "bg-gray-900" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
              <div className="flex-1 pt-1">
                <p
                  className={`text-sm font-medium mb-1 transition-colors duration-500 ${
                    isActive ? "text-gray-900" : "text-gray-400"
                  }`}
                >
                  {item.label}
                </p>
                <p
                  className={`text-xs leading-relaxed transition-colors duration-500 ${
                    isActive ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Email Thread */}
      <div className="lg:col-span-2 relative rounded-2xl border border-gray-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] overflow-hidden max-h-[80vh] flex flex-col">
        <div className="px-4 sm:px-5 py-3 border-b border-gray-200 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-gray-500">
              Inbox · Reply
            </p>
            <p className="text-base sm:text-lg font-editorial text-black">
              {ORIGINAL_EMAIL.subject}
            </p>
          </div>
          <span
            className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all duration-500 ${statusClass}`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="divide-y divide-gray-100 overflow-y-auto flex-1">
          <div className="px-4 sm:px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-900 text-white text-xs font-medium flex items-center justify-center flex-shrink-0">
                MP
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-900">
                      {ORIGINAL_EMAIL.from}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-500">
                      {ORIGINAL_EMAIL.date}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                    To {ORIGINAL_EMAIL.to}
                  </p>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-gray-800 whitespace-pre-line font-primary">
                  {ORIGINAL_EMAIL.body}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 min-h-[220px] px-4 sm:px-5 py-4">
            <div className="flex items-start gap-3 h-full">
              <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center flex-shrink-0">
                Y
              </div>
              <div className="flex-1 min-w-0 space-y-2 flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs sm:text-sm font-medium text-gray-900">
                    You
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-500">
                    Draft
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full transition-colors duration-300 ${
                      showReady
                        ? "bg-black text-white"
                        : showGenerating
                          ? "border border-blue-200 bg-white text-blue-700"
                          : "border border-gray-200 text-gray-500 bg-white"
                    }`}
                  >
                    {showReady
                      ? "Ready"
                      : showGenerating
                        ? "Generating"
                        : "Queued"}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  To {ORIGINAL_EMAIL.fromEmail}
                </p>
                <div className="flex-1 flex flex-col justify-center">
                  {(showPlaceholder || showGenerating) && (
                    <div className="flex items-start gap-2 text-[11px] sm:text-xs text-gray-600">
                      <div className="flex gap-1 pt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse" />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        />
                        <div
                          className="w-1.5 h-1.5 rounded-full bg-gray-700 animate-pulse"
                          style={{ animationDelay: "0.4s" }}
                        />
                      </div>
                      <span className="flex-1">
                        {showGenerating
                          ? "Referencing your Notion plan, budget follow-up, and owner matrix to draft a response."
                          : "Waiting to generate your reply..."}
                      </span>
                    </div>
                  )}
                  {showReady && (
                    <p
                      className="text-xs sm:text-sm leading-relaxed text-gray-800 whitespace-pre-line font-primary"
                      style={{ animation: "slideInUp 0.4s ease-out" }}
                    >
                      {EMAIL_DRAFT_BODY}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
