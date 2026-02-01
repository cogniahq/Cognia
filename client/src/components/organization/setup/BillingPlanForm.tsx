import { useState } from "react"
import { CreditCard, Building, Check, Crown, Sparkles } from "lucide-react"
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
    icon: Sparkles,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "per user/month",
    description: "For growing teams",
    features: [
      "Unlimited team members",
      "50GB document storage",
      "Advanced AI features",
      "Priority support",
      "Custom branding",
    ],
    popular: true,
    icon: Crown,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "contact sales",
    description: "For large organizations",
    features: [
      "Everything in Pro",
      "Unlimited storage",
      "SSO/SAML integration",
      "Dedicated support",
      "SLA guarantee",
      "Custom contracts",
    ],
    icon: Building,
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
    billingAddress: organization.billing_address || {},
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
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Plan
        </label>
        <div className="grid grid-cols-1 gap-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon
            const isSelected = selectedPlan === plan.id
            return (
              <div
                key={plan.id}
                onClick={() => {
                  setSelectedPlan(plan.id as "free" | "pro" | "enterprise")
                  handleChange("plan", plan.id)
                }}
                className={`
                  relative p-4 border-2 rounded-lg cursor-pointer transition-all
                  ${
                    isSelected
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200 hover:border-gray-300"
                  }
                `}
              >
                {plan.popular && (
                  <span className="absolute -top-2 right-4 px-2 py-0.5 bg-gray-900 text-white text-xs font-medium rounded">
                    Popular
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div
                    className={`
                      p-2 rounded-lg
                      ${isSelected ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}
                    `}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                      <div className="text-right">
                        <span className="text-xl font-bold text-gray-900">
                          {plan.price}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">
                          {plan.period}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                    <ul className="mt-3 space-y-1">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-sm text-gray-600"
                        >
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className={`
                      w-5 h-5 rounded-full border-2 flex items-center justify-center
                      ${isSelected ? "border-gray-900 bg-gray-900" : "border-gray-300"}
                    `}
                  >
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Billing Details */}
      <div className="space-y-4 pt-4 border-t">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <CreditCard className="h-4 w-4" />
          Billing Details
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Legal Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.legalName}
            onChange={(e) => handleChange("legalName", e.target.value)}
            placeholder="Acme Corporation Inc."
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Billing Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={formData.billingEmail}
            onChange={(e) => handleChange("billingEmail", e.target.value)}
            placeholder="billing@company.com"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            VAT/Tax ID <span className="text-gray-400">(optional)</span>
          </label>
          <input
            type="text"
            value={formData.vatTaxId}
            onChange={(e) => handleChange("vatTaxId", e.target.value)}
            placeholder="EU VAT number or Tax ID"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {selectedPlan === "enterprise" && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Our team will contact you to discuss custom pricing and requirements
            for your enterprise deployment.
          </p>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 text-sm text-red-600 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </form>
  )
}
