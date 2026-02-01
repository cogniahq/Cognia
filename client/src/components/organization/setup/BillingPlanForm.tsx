import { useState } from "react"
import type { Organization } from "@/types/organization"
import { updateBilling, type UpdateBillingRequest } from "@/services/organization/organization.service"

interface BillingPlanFormProps {
  organization: Organization
  onComplete: () => void
  onCancel: () => void
}

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For small teams getting started",
    features: [
      "Up to 5 team members",
      "1GB document storage",
      "Basic AI features",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "/user/mo",
    description: "For growing teams",
    features: [
      "Unlimited team members",
      "50GB document storage",
      "Advanced AI features",
      "Priority support",
      "Custom branding",
    ],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For large organizations",
    features: [
      "Everything in Pro",
      "Unlimited storage",
      "SSO/SAML integration",
      "Dedicated support",
      "SLA guarantee",
    ],
  },
]

export function BillingPlanForm({
  organization,
  onComplete,
  onCancel,
}: BillingPlanFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [selectedPlan, setSelectedPlan] = useState<"free" | "pro" | "enterprise">(
    (organization.plan as "free" | "pro" | "enterprise") || "free"
  )

  const [formData, setFormData] = useState<UpdateBillingRequest>({
    legalName: organization.legal_name || "",
    billingEmail: organization.billing_email || "",
    vatTaxId: organization.vat_tax_id || "",
    plan: selectedPlan,
  })

  const handleChange = (field: keyof UpdateBillingRequest, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.legalName?.trim()) {
      setError("Legal company name is required")
      return
    }

    if (!formData.billingEmail?.trim()) {
      setError("Billing email is required")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      await updateBilling(organization.slug, {
        ...formData,
        plan: selectedPlan,
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update billing")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Plan Selection */}
      <div>
        <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-3">
          Select Plan
        </label>
        <div className="space-y-2">
          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id
            return (
              <div
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan.id as "free" | "pro" | "enterprise")
                  handleChange("plan", plan.id)
                }}
                className={`
                  relative p-4 border cursor-pointer transition-colors
                  ${isSelected ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"}
                `}
              >
                {plan.popular && (
                  <span className="absolute -top-2 right-4 px-2 py-0.5 bg-gray-900 text-white text-xs font-mono">
                    Popular
                  </span>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                          w-4 h-4 border flex items-center justify-center
                          ${isSelected ? "border-gray-900 bg-gray-900" : "border-gray-300"}
                        `}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <h3 className="font-medium text-gray-900">{plan.name}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 ml-7">{plan.description}</p>
                    <ul className="mt-2 ml-7 space-y-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="text-xs text-gray-600">
                          · {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-lg font-bold text-gray-900">{plan.price}</span>
                    <span className="text-xs text-gray-500">{plan.period}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Billing Details */}
      <div className="space-y-4 pt-4 border-t border-gray-200">
        <div className="text-xs font-mono text-gray-500 uppercase tracking-wider">
          [BILLING DETAILS]
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
            Legal Company Name *
          </label>
          <input
            type="text"
            value={formData.legalName}
            onChange={(e) => handleChange("legalName", e.target.value)}
            placeholder="Acme Corporation Inc."
            className="w-full px-3 py-2 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
            Billing Email *
          </label>
          <input
            type="email"
            value={formData.billingEmail}
            onChange={(e) => handleChange("billingEmail", e.target.value)}
            placeholder="billing@company.com"
            className="w-full px-3 py-2 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900"
          />
        </div>

        <div>
          <label className="block text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">
            VAT/Tax ID <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.vatTaxId}
            onChange={(e) => handleChange("vatTaxId", e.target.value)}
            placeholder="EU VAT number or Tax ID"
            className="w-full px-3 py-2 border border-gray-300 text-sm font-mono focus:outline-none focus:border-gray-900"
          />
        </div>
      </div>

      {selectedPlan === "enterprise" && (
        <div className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-gray-600">
          Our team will contact you to discuss custom pricing and requirements.
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs font-mono text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-xs font-mono bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </form>
  )
}
