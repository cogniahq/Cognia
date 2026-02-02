import React, { useEffect, useState } from "react"
import { ProfileService, type UserProfile } from "@/services/profile.service"
import { requireAuthToken } from "@/utils/auth"
import { useNavigate } from "react-router-dom"

import { PageHeader } from "@/components/shared/PageHeader"
import { useAuth } from "@/contexts/auth.context"
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings"

import { EmptyState, ErrorMessage } from "../components/ui/loading-spinner"

export const Profile: React.FC = () => {
  const navigate = useNavigate()
  const { accountType } = useAuth()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      requireAuthToken()
      setIsAuthenticated(true)
    } catch (error) {
      navigate("/login")
    }
  }, [navigate])

  useEffect(() => {
    if (!isAuthenticated) return

    const fetchProfile = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await ProfileService.getProfile()
        setProfile(data)
      } catch (err) {
        const error = err as { message?: string }
        console.error("Error fetching profile:", err)
        setError(error.message || "Failed to load profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [isAuthenticated])

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true)
      setError(null)
      const data = await ProfileService.refreshProfile()
      setProfile(data)
    } catch (err) {
      const error = err as { code?: string; message?: string }
      console.error("Error refreshing profile:", err)
      if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
        setError(
          "Profile refresh is taking longer than expected. Please try again in a moment."
        )
      } else {
        setError(error.message || "Failed to refresh profile")
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!isAuthenticated) {
    return null
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm font-mono text-gray-600">
          Loading profile...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader pageName="Profile" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
              <div className="flex items-center gap-2">
                {profile && (
                  <div className="text-xs font-mono text-gray-500">
                    v{profile.version}
                  </div>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 text-xs font-mono text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Your automatically maintained profile based on processed content
            </p>
          </div>

          {/* Account Type (read-only) */}
          <div className="bg-white border border-gray-200 p-4">
            <div className="text-sm font-mono text-gray-600 mb-3 uppercase tracking-wide">
              [ACCOUNT TYPE]
            </div>
            <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200">
              {accountType === "ORGANIZATION" ? (
                <>
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Team Workspace</div>
                    <div className="text-xs text-gray-500">Documents & Team Search</div>
                  </div>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">Personal Account</div>
                    <div className="text-xs text-gray-500">Memories & Knowledge Mesh</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Security Settings - 2FA */}
          <TwoFactorSettings />

          {error && (
            <ErrorMessage message={error} onRetry={() => setError(null)} />
          )}

          {!profile && !error && (
            <EmptyState
              title="No profile available"
              description="Process some content to generate your profile"
              action={{
                label: "Go to Memories",
                onClick: () => navigate("/memories"),
              }}
            />
          )}

          {profile && (
            <div className="space-y-6">
              {/* Profile Metadata */}
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-sm font-mono text-gray-600 mb-2 uppercase tracking-wide">
                  [PROFILE METADATA]
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-mono">
                  <div>
                    <span className="text-gray-600">Version:</span>{" "}
                    <span className="text-gray-900">{profile.version}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Last Updated:</span>{" "}
                    <span className="text-gray-900">
                      {new Date(profile.last_updated).toLocaleString()}
                    </span>
                  </div>
                  {profile.last_memory_analyzed && (
                    <div>
                      <span className="text-gray-600">
                        Last Memory Analyzed:
                      </span>{" "}
                      <span className="text-gray-900">
                        {new Date(
                          profile.last_memory_analyzed
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Static Profile */}
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
                  [STATIC PROFILE - LONG-TERM FACTS]
                </div>

                {profile.static_profile.text && (
                  <div className="mb-4">
                    <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                      [NATURAL LANGUAGE SUMMARY]
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {profile.static_profile.text}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.isArray(profile.static_profile.json.interests) &&
                    profile.static_profile.json.interests.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [INTERESTS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.interests.map(
                            (interest, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700"
                              >
                                {interest}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(profile.static_profile.json.skills) &&
                    profile.static_profile.json.skills.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [SKILLS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.skills.map(
                            (skill, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700"
                              >
                                {skill}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.profession && (
                    <div>
                      <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                        [PROFESSION]
                      </div>
                      <p className="text-sm font-mono text-gray-900">
                        {profile.static_profile.json.profession}
                      </p>
                    </div>
                  )}

                  {Array.isArray(profile.static_profile.json.domains) &&
                    profile.static_profile.json.domains.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [DOMAINS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.domains.map(
                            (domain, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700"
                              >
                                {domain}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(profile.static_profile.json.expertise_areas) &&
                    profile.static_profile.json.expertise_areas.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [EXPERTISE AREAS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.expertise_areas.map(
                            (area, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700"
                              >
                                {area}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(
                    profile.static_profile.json.long_term_patterns
                  ) &&
                    profile.static_profile.json.long_term_patterns.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [LONG-TERM PATTERNS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.long_term_patterns.map(
                            (pattern, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-gray-100 border border-gray-300 text-gray-700"
                              >
                                {pattern}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.demographics && (
                    <div>
                      <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                        [DEMOGRAPHICS]
                      </div>
                      <div className="space-y-1 text-sm font-mono">
                        {profile.static_profile.json.demographics.age_range && (
                          <div>
                            <span className="text-gray-600">Age Range:</span>{" "}
                            <span className="text-gray-900">
                              {
                                profile.static_profile.json.demographics
                                  .age_range
                              }
                            </span>
                          </div>
                        )}
                        {profile.static_profile.json.demographics.location && (
                          <div>
                            <span className="text-gray-600">Location:</span>{" "}
                            <span className="text-gray-900">
                              {
                                profile.static_profile.json.demographics
                                  .location
                              }
                            </span>
                          </div>
                        )}
                        {profile.static_profile.json.demographics.education && (
                          <div>
                            <span className="text-gray-600">Education:</span>{" "}
                            <span className="text-gray-900">
                              {
                                profile.static_profile.json.demographics
                                  .education
                              }
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {Array.isArray(
                    profile.static_profile.json.personality_traits
                  ) &&
                    profile.static_profile.json.personality_traits.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [PERSONALITY TRAITS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.personality_traits.map(
                            (trait, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-purple-50 border border-purple-200 text-gray-700"
                              >
                                {trait}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.work_style &&
                    Object.keys(profile.static_profile.json.work_style).length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [WORK STYLE]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {profile.static_profile.json.work_style
                            .preferred_work_hours && (
                            <div>
                              <span className="text-gray-600">Work Hours:</span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.work_style
                                    .preferred_work_hours
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.work_style
                            .collaboration_style && (
                            <div>
                              <span className="text-gray-600">
                                Collaboration:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.work_style
                                    .collaboration_style
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.work_style
                            .decision_making_style && (
                            <div>
                              <span className="text-gray-600">
                                Decision Making:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.work_style
                                    .decision_making_style
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.work_style
                            .problem_solving_approach && (
                            <div>
                              <span className="text-gray-600">
                                Problem Solving:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.work_style
                                    .problem_solving_approach
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.communication_style &&
                    Object.keys(profile.static_profile.json.communication_style)
                      .length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [COMMUNICATION STYLE]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {Array.isArray(
                            profile.static_profile.json.communication_style
                              .preferred_channels
                          ) &&
                            profile.static_profile.json.communication_style
                              .preferred_channels.length > 0 && (
                              <div>
                                <span className="text-gray-600">Channels:</span>{" "}
                                <span className="text-gray-900">
                                  {profile.static_profile.json.communication_style.preferred_channels.join(
                                    ", "
                                  )}
                                </span>
                              </div>
                            )}
                          {profile.static_profile.json.communication_style
                            .communication_frequency && (
                            <div>
                              <span className="text-gray-600">Frequency:</span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json
                                    .communication_style.communication_frequency
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.communication_style
                            .tone_preference && (
                            <div>
                              <span className="text-gray-600">Tone:</span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json
                                    .communication_style.tone_preference
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.learning_preferences &&
                    Object.keys(
                      profile.static_profile.json.learning_preferences
                    ).length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [LEARNING PREFERENCES]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {Array.isArray(
                            profile.static_profile.json.learning_preferences
                              .preferred_learning_methods
                          ) &&
                            profile.static_profile.json.learning_preferences
                              .preferred_learning_methods.length > 0 && (
                              <div>
                                <span className="text-gray-600">Methods:</span>{" "}
                                <span className="text-gray-900">
                                  {profile.static_profile.json.learning_preferences.preferred_learning_methods.join(
                                    ", "
                                  )}
                                </span>
                              </div>
                            )}
                          {profile.static_profile.json.learning_preferences
                            .learning_pace && (
                            <div>
                              <span className="text-gray-600">Pace:</span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json
                                    .learning_preferences.learning_pace
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.learning_preferences
                            .knowledge_retention_style && (
                            <div>
                              <span className="text-gray-600">
                                Retention Style:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json
                                    .learning_preferences
                                    .knowledge_retention_style
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(
                    profile.static_profile.json.values_and_priorities
                  ) &&
                    profile.static_profile.json.values_and_priorities.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [VALUES & PRIORITIES]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.static_profile.json.values_and_priorities.map(
                            (value, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-green-50 border border-green-200 text-gray-700"
                              >
                                {value}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.technology_preferences &&
                    Object.keys(
                      profile.static_profile.json.technology_preferences
                    ).length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [TECHNOLOGY PREFERENCES]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {Array.isArray(
                            profile.static_profile.json.technology_preferences
                              .preferred_tools
                          ) &&
                            profile.static_profile.json.technology_preferences
                              .preferred_tools.length > 0 && (
                              <div>
                                <span className="text-gray-600">Tools:</span>{" "}
                                <span className="text-gray-900">
                                  {profile.static_profile.json.technology_preferences.preferred_tools.join(
                                    ", "
                                  )}
                                </span>
                              </div>
                            )}
                          {profile.static_profile.json.technology_preferences
                            .tech_comfort_level && (
                            <div>
                              <span className="text-gray-600">
                                Comfort Level:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json
                                    .technology_preferences.tech_comfort_level
                                }
                              </span>
                            </div>
                          )}
                          {Array.isArray(
                            profile.static_profile.json.technology_preferences
                              .preferred_platforms
                          ) &&
                            profile.static_profile.json.technology_preferences
                              .preferred_platforms.length > 0 && (
                              <div>
                                <span className="text-gray-600">
                                  Platforms:
                                </span>{" "}
                                <span className="text-gray-900">
                                  {profile.static_profile.json.technology_preferences.preferred_platforms.join(
                                    ", "
                                  )}
                                </span>
                              </div>
                            )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.lifestyle_patterns &&
                    Object.keys(profile.static_profile.json.lifestyle_patterns)
                      .length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [LIFESTYLE PATTERNS]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {profile.static_profile.json.lifestyle_patterns
                            .activity_level && (
                            <div>
                              <span className="text-gray-600">
                                Activity Level:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.lifestyle_patterns
                                    .activity_level
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.lifestyle_patterns
                            .social_patterns && (
                            <div>
                              <span className="text-gray-600">
                                Social Patterns:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.lifestyle_patterns
                                    .social_patterns
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.lifestyle_patterns
                            .productivity_patterns && (
                            <div>
                              <span className="text-gray-600">
                                Productivity:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.lifestyle_patterns
                                    .productivity_patterns
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {profile.static_profile.json.cognitive_style &&
                    Object.keys(profile.static_profile.json.cognitive_style)
                      .length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [COGNITIVE STYLE]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {profile.static_profile.json.cognitive_style
                            .thinking_pattern && (
                            <div>
                              <span className="text-gray-600">Thinking:</span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.cognitive_style
                                    .thinking_pattern
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.cognitive_style
                            .information_processing && (
                            <div>
                              <span className="text-gray-600">
                                Information Processing:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.cognitive_style
                                    .information_processing
                                }
                              </span>
                            </div>
                          )}
                          {profile.static_profile.json.cognitive_style
                            .creativity_level && (
                            <div>
                              <span className="text-gray-600">Creativity:</span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.static_profile.json.cognitive_style
                                    .creativity_level
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>

              {/* Dynamic Profile */}
              <div className="bg-white border border-gray-200 p-4">
                <div className="text-sm font-mono text-gray-600 mb-4 uppercase tracking-wide">
                  [DYNAMIC PROFILE - RECENT CONTEXT]
                </div>

                {profile.dynamic_profile.text && (
                  <div className="mb-4">
                    <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                      [NATURAL LANGUAGE SUMMARY]
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {profile.dynamic_profile.text}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.isArray(
                    profile.dynamic_profile.json.recent_activities
                  ) &&
                    profile.dynamic_profile.json.recent_activities.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [RECENT ACTIVITIES]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.recent_activities.map(
                            (activity, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{activity}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.current_projects
                  ) &&
                    profile.dynamic_profile.json.current_projects.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [CURRENT PROJECTS]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.current_projects.map(
                            (project, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{project}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.temporary_interests
                  ) &&
                    profile.dynamic_profile.json.temporary_interests.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [TEMPORARY INTERESTS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.dynamic_profile.json.temporary_interests.map(
                            (interest, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-yellow-50 border border-yellow-200 text-gray-700"
                              >
                                {interest}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(profile.dynamic_profile.json.recent_changes) &&
                    profile.dynamic_profile.json.recent_changes.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [RECENT CHANGES]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.recent_changes.map(
                            (change, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{change}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.current_context
                  ) &&
                    profile.dynamic_profile.json.current_context.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [CURRENT CONTEXT]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.dynamic_profile.json.current_context.map(
                            (context, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-blue-50 border border-blue-200 text-gray-700"
                              >
                                {context}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(profile.dynamic_profile.json.active_goals) &&
                    profile.dynamic_profile.json.active_goals.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [ACTIVE GOALS]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.active_goals.map(
                            (goal, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{goal}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.current_challenges
                  ) &&
                    profile.dynamic_profile.json.current_challenges.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [CURRENT CHALLENGES]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.current_challenges.map(
                            (challenge, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{challenge}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.recent_achievements
                  ) &&
                    profile.dynamic_profile.json.recent_achievements.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [RECENT ACHIEVEMENTS]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.recent_achievements.map(
                            (achievement, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{achievement}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.current_focus_areas
                  ) &&
                    profile.dynamic_profile.json.current_focus_areas.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [CURRENT FOCUS AREAS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.dynamic_profile.json.current_focus_areas.map(
                            (area, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-indigo-50 border border-indigo-200 text-gray-700"
                              >
                                {area}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {profile.dynamic_profile.json.emotional_state &&
                    Object.keys(profile.dynamic_profile.json.emotional_state)
                      .length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [EMOTIONAL STATE]
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                          {Array.isArray(
                            profile.dynamic_profile.json.emotional_state
                              .current_concerns
                          ) &&
                            profile.dynamic_profile.json.emotional_state
                              .current_concerns.length > 0 && (
                              <div>
                                <span className="text-gray-600">Concerns:</span>{" "}
                                <span className="text-gray-900">
                                  {profile.dynamic_profile.json.emotional_state.current_concerns.join(
                                    ", "
                                  )}
                                </span>
                              </div>
                            )}
                          {Array.isArray(
                            profile.dynamic_profile.json.emotional_state
                              .current_excitements
                          ) &&
                            profile.dynamic_profile.json.emotional_state
                              .current_excitements.length > 0 && (
                              <div>
                                <span className="text-gray-600">
                                  Excitements:
                                </span>{" "}
                                <span className="text-gray-900">
                                  {profile.dynamic_profile.json.emotional_state.current_excitements.join(
                                    ", "
                                  )}
                                </span>
                              </div>
                            )}
                          {profile.dynamic_profile.json.emotional_state
                            .stress_level && (
                            <div>
                              <span className="text-gray-600">
                                Stress Level:
                              </span>{" "}
                              <span className="text-gray-900">
                                {
                                  profile.dynamic_profile.json.emotional_state
                                    .stress_level
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.active_research_topics
                  ) &&
                    profile.dynamic_profile.json.active_research_topics.length >
                      0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [ACTIVE RESEARCH TOPICS]
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {profile.dynamic_profile.json.active_research_topics.map(
                            (topic, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs font-mono bg-orange-50 border border-orange-200 text-gray-700"
                              >
                                {topic}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}

                  {Array.isArray(
                    profile.dynamic_profile.json.upcoming_events
                  ) &&
                    profile.dynamic_profile.json.upcoming_events.length > 0 && (
                      <div>
                        <div className="text-xs font-mono text-gray-500 mb-2 uppercase tracking-wide">
                          [UPCOMING EVENTS]
                        </div>
                        <ul className="space-y-1 text-sm font-mono text-gray-700">
                          {profile.dynamic_profile.json.upcoming_events.map(
                            (event, idx) => (
                              <li key={idx} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{event}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
