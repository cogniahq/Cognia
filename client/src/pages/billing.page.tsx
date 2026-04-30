import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth.context"
import { useOrganization } from "@/contexts/organization.context"
import { getPlanTier, type PlanId } from "@/data/plans"
import {
  billingService,
  type BillingResponse,
} from "@/services/billing.service"
import { requireAuthToken } from "@/utils/auth"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { openRazorpaySubscriptionCheckout } from "@/lib/razorpay"
import { DunningBanner } from "@/components/billing/DunningBanner"
import { PlanComparisonTable } from "@/components/billing/PlanComparisonTable"
import { UsageBurndownCard } from "@/components/billing/UsageBurndownCard"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/shared/site-motion-variants"

function formatAmount(paise?: number, currency?: string): string {
  if (paise == null) return "—"
  // Razorpay reports amounts in paise (smallest unit). Same scale (×100) for
  // INR + USD plans, so dividing by 100 gives the major unit.
  const amount = (paise / 100).toFixed(2)
  return `${currency?.toUpperCase() || "INR"} ${amount}`
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return iso
  }
}

export function Billing() {
  const navigate = useNavigate()
  const { isLoading: authLoading, user } = useAuth()
  const { currentOrganization, organizations, loadOrganizations } =
    useOrganization()

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [data, setData] = useState<BillingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null)
  const [actionBusy, setActionBusy] = useState<
    "cancel" | "pause" | "resume" | null
  >(null)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch {
      navigate("/login")
    }
  }, [navigate])

  useEffect(() => {
    if (isAuthenticated && organizations.length === 0) {
      loadOrganizations()
    }
  }, [isAuthenticated, organizations.length, loadOrganizations])

  const slug = currentOrganization?.slug

  const fetchBilling = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await billingService.get(slug)
      setData(res.data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load billing"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    if (slug) fetchBilling()
  }, [slug, fetchBilling])

  const onCancel = useCallback(async () => {
    if (!slug) return
    if (
      !window.confirm("Cancel subscription at the end of the current period?")
    )
      return
    setActionBusy("cancel")
    try {
      await billingService.cancel(slug, true)
      toast.success("Subscription set to cancel at period end")
      await fetchBilling()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not cancel subscription"
      )
    } finally {
      setActionBusy(null)
    }
  }, [slug, fetchBilling])

  const onPause = useCallback(async () => {
    if (!slug) return
    setActionBusy("pause")
    try {
      await billingService.pause(slug)
      toast.success("Subscription paused")
      await fetchBilling()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not pause subscription"
      )
    } finally {
      setActionBusy(null)
    }
  }, [slug, fetchBilling])

  const onResume = useCallback(async () => {
    if (!slug) return
    setActionBusy("resume")
    try {
      await billingService.resume(slug)
      toast.success("Subscription resumed")
      await fetchBilling()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not resume subscription"
      )
    } finally {
      setActionBusy(null)
    }
  }, [slug, fetchBilling])

  const onUpdatePayment = useCallback(async () => {
    // Razorpay has no hosted billing portal — when payments fail the user
    // re-authorises by going through Checkout again with the same plan.
    if (!slug) return
    const planId = (data?.subscription as { plan_id?: string } | null)?.plan_id
    const tier =
      planId === "pro" || planId === "enterprise" ? (planId as PlanId) : "pro"
    await onUpgrade(tier)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, data])

  const onUpgrade = useCallback(
    async (planTierId: PlanId) => {
      if (!slug) return
      if (planTierId === "enterprise") {
        window.location.href =
          "mailto:sales@cognia.so?subject=Cognia%20Enterprise"
        return
      }
      if (planTierId === "free") return

      const razorpayPlanId =
        planTierId === "pro"
          ? import.meta.env.VITE_RAZORPAY_PLAN_PRO
          : undefined

      if (!razorpayPlanId) {
        toast.error("Billing not configured. Contact your admin.")
        return
      }

      setPendingPlan(planTierId)
      try {
        const out = await billingService.checkout(slug, razorpayPlanId)
        if (!out.keyId) throw new Error("Razorpay not configured server-side")
        await openRazorpaySubscriptionCheckout({
          keyId: out.keyId,
          subscriptionId: out.subscriptionId,
          name: "Cognia",
          description: `${planTierId === "pro" ? "Pro" : "Enterprise"} subscription`,
          prefillEmail: user?.email,
          onSuccess: () => {
            toast.success("Subscription activated. Refreshing…")
            // Webhook will sync our DB shortly after; refetch.
            setTimeout(() => fetchBilling(), 1500)
          },
          onDismiss: () => toast("Checkout closed"),
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not start checkout"
        toast.error(message)
      } finally {
        setPendingPlan(null)
      }
    },
    [slug, user?.email, fetchBilling]
  )

  if (!isAuthenticated || authLoading) return null

  if (!slug) {
    return (
      <div className="min-h-screen bg-white">
        <PageHeader pageName="Billing" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h1 className="text-2xl font-light font-editorial text-gray-900">
            No workspace selected
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Select an organization to view billing.
          </p>
        </div>
      </div>
    )
  }

  const currentPlanId = (data?.usage?.plan ||
    (data?.subscription as { plan_id?: string } | null)?.plan_id ||
    "free") as string
  const currentTier = getPlanTier(currentPlanId)
  const subscription = data?.subscription || null
  const usage = data?.usage?.usage
  const invoices = data?.invoices ?? []
  const subStatus = (
    subscription as { status?: string } | null
  )?.status?.toLowerCase()
  const hasActiveSub =
    !!subscription &&
    subStatus !== "cancelled" &&
    subStatus !== "completed" &&
    subStatus !== "expired"
  const isPaused = subStatus === "paused"

  return (
    <div className="min-h-screen bg-white">
      <PageHeader pageName="Billing" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <motion.div
          className="space-y-8"
          initial="initial"
          animate="animate"
          variants={staggerContainerVariants}
        >
          <motion.div variants={fadeUpVariants}>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-300/60 px-3 py-1 text-[11px] tracking-[0.2em] uppercase text-gray-600 mb-3">
              Workspace
              <span className="w-1 h-1 rounded-full bg-gray-500" />
              Billing
            </div>
            <h1 className="text-2xl sm:text-3xl font-light font-editorial text-black">
              Billing & plan
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">
              {currentOrganization?.name} · {slug}
            </p>
          </motion.div>

          {/* Dunning banner */}
          {subscription && (
            <motion.div variants={fadeUpVariants}>
              <DunningBanner
                subscription={subscription}
                onUpdatePayment={onUpdatePayment}
              />
            </motion.div>
          )}

          {loading && (
            <div className="text-sm font-mono text-gray-500">
              Loading billing…
            </div>
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Current plan + usage */}
              <motion.div
                variants={fadeUpVariants}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wide text-gray-500 mb-1">
                      Current plan
                    </div>
                    <h2 className="text-xl font-medium text-gray-900">
                      {currentTier?.displayName ?? currentPlanId}
                    </h2>
                    {(subscription as { status?: string } | null)?.status && (
                      <div className="text-xs text-gray-500 mt-1 font-mono">
                        Status:{" "}
                        {(subscription as { status?: string } | null)?.status}
                        {(
                          subscription as { current_period_end?: string } | null
                        )?.current_period_end && (
                          <>
                            {" · "}Renews{" "}
                            {formatDate(
                              (subscription as { current_period_end?: string })
                                .current_period_end
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {hasActiveSub && (
                    <div className="flex flex-wrap items-center gap-2">
                      {isPaused ? (
                        <button
                          onClick={onResume}
                          disabled={actionBusy !== null || !data.billingEnabled}
                          className="px-3 py-2 text-xs font-mono uppercase tracking-wide border border-gray-300 text-gray-900 hover:border-black hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {actionBusy === "resume" ? "Resuming..." : "Resume"}
                        </button>
                      ) : (
                        <button
                          onClick={onPause}
                          disabled={actionBusy !== null || !data.billingEnabled}
                          className="px-3 py-2 text-xs font-mono uppercase tracking-wide border border-gray-300 text-gray-900 hover:border-black hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {actionBusy === "pause" ? "Pausing..." : "Pause"}
                        </button>
                      )}
                      <button
                        onClick={onCancel}
                        disabled={actionBusy !== null || !data.billingEnabled}
                        className="px-3 py-2 text-xs font-mono uppercase tracking-wide border border-red-300 text-red-700 hover:border-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {actionBusy === "cancel" ? "Cancelling..." : "Cancel"}
                      </button>
                    </div>
                  )}
                </div>

                {usage && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <UsageBurndownCard
                      label="Seats"
                      current={usage.seats.current}
                      limit={usage.seats.limit}
                    />
                    <UsageBurndownCard
                      label="Memories"
                      current={usage.memories.current}
                      limit={usage.memories.limit}
                    />
                    <UsageBurndownCard
                      label="Integrations"
                      current={usage.integrations.current}
                      limit={usage.integrations.limit}
                    />
                  </div>
                )}
              </motion.div>

              {/* Invoices */}
              <motion.div
                variants={fadeUpVariants}
                className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6"
              >
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Recent invoices
                </h2>
                {invoices.length === 0 ? (
                  <div className="text-sm text-gray-500">No invoices yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs font-mono uppercase tracking-wide text-gray-500 border-b border-gray-200">
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Amount</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => (
                          <tr
                            key={inv.id}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-2 pr-4 text-gray-700">
                              {formatDate(inv.created_at ?? inv.created)}
                            </td>
                            <td className="py-2 pr-4 text-gray-700">
                              {formatAmount(
                                inv.amount_paid_paise ?? inv.amount_due_paise,
                                inv.currency
                              )}
                            </td>
                            <td className="py-2 pr-4">
                              <span
                                className={`text-[10px] font-mono uppercase tracking-[0.2em] px-2 py-0.5 border ${
                                  inv.status === "paid"
                                    ? "border-emerald-500 text-emerald-700"
                                    : inv.status === "issued"
                                      ? "border-amber-500 text-amber-700"
                                      : "border-gray-300 text-gray-600"
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right">
                              {(inv.hosted_url ?? inv.hostedInvoiceUrl) ? (
                                <a
                                  href={
                                    (inv.hosted_url ?? inv.hostedInvoiceUrl) ||
                                    "#"
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs font-mono text-gray-900 underline hover:text-black"
                                >
                                  View
                                </a>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>

              {/* Plan comparison */}
              <motion.div variants={fadeUpVariants}>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Compare plans
                </h2>
                <PlanComparisonTable
                  currentPlanId={currentPlanId}
                  onUpgrade={onUpgrade}
                  pendingPlanId={pendingPlan}
                />
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}

export default Billing
