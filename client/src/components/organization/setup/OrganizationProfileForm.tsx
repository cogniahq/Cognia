import { useState, useRef } from "react"
import { Upload, Globe, MapPin, Clock, Building2 } from "lucide-react"
import type { Organization } from "@/types/organization"
import { updateProfile, type UpdateProfileRequest } from "@/services/organization/organization.service"

interface OrganizationProfileFormProps {
  organization: Organization
  onComplete: () => void
  onCancel: () => void
}

const TIMEZONES = [
  { value: "America/New_York", label: "(UTC-05:00) Eastern Time" },
  { value: "America/Chicago", label: "(UTC-06:00) Central Time" },
  { value: "America/Denver", label: "(UTC-07:00) Mountain Time" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Pacific Time" },
  { value: "Europe/London", label: "(UTC+00:00) London" },
  { value: "Europe/Paris", label: "(UTC+01:00) Paris" },
  { value: "Europe/Berlin", label: "(UTC+01:00) Berlin" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Tokyo" },
  { value: "Asia/Shanghai", label: "(UTC+08:00) Shanghai" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Singapore" },
  { value: "Australia/Sydney", label: "(UTC+11:00) Sydney" },
]

const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "Singapore",
  "Netherlands",
  "Switzerland",
  "Other",
]

export function OrganizationProfileForm({
  organization,
  onComplete,
  onCancel,
}: OrganizationProfileFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState<UpdateProfileRequest>({
    name: organization.name || "",
    slug: organization.slug || "",
    description: organization.description || "",
    logo: organization.logo || "",
    website: organization.website || "",
    streetAddress: organization.street_address || "",
    city: organization.city || "",
    stateRegion: organization.state_region || "",
    postalCode: organization.postal_code || "",
    country: organization.country || "",
    timezone: organization.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  })

  const handleChange = (field: keyof UpdateProfileRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError("")
  }

  const handleLogoUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // For now, just create a local URL - in production, you'd upload to cloud storage
      const reader = new FileReader()
      reader.onload = (event) => {
        setFormData((prev) => ({ ...prev, logo: event.target?.result as string }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError("")

    try {
      await updateProfile(organization.slug, formData)
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Logo Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Upload className="inline h-4 w-4 mr-1" />
          Logo
        </label>
        <div className="flex items-center gap-4">
          <div
            onClick={handleLogoUpload}
            className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors overflow-hidden"
          >
            {formData.logo ? (
              <img
                src={formData.logo}
                alt="Logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-gray-400 text-xs text-center">
                + Add
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            <p>PNG, JPG up to 2MB</p>
            <p>Recommended: 256x256px</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Workspace Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Building2 className="inline h-4 w-4 mr-1" />
          Workspace Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange("description", e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Brief description of your organization..."
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          {formData.description?.length || 0}/500 characters
        </p>
      </div>

      {/* Website */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Globe className="inline h-4 w-4 mr-1" />
          Website
        </label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => handleChange("website", e.target.value)}
          placeholder="https://example.com"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Address Section */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          <MapPin className="inline h-4 w-4 mr-1" />
          Address
        </label>

        <input
          type="text"
          value={formData.streetAddress}
          onChange={(e) => handleChange("streetAddress", e.target.value)}
          placeholder="Street address"
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            placeholder="City"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <input
            type="text"
            value={formData.stateRegion}
            onChange={(e) => handleChange("stateRegion", e.target.value)}
            placeholder="State/Region"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            value={formData.postalCode}
            onChange={(e) => handleChange("postalCode", e.target.value)}
            placeholder="Postal code"
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <select
            value={formData.country}
            onChange={(e) => handleChange("country", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          <Clock className="inline h-4 w-4 mr-1" />
          Timezone
        </label>
        <select
          value={formData.timezone}
          onChange={(e) => handleChange("timezone", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>

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
