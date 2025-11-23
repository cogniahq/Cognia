import { getRequest, postRequest } from "../utils/general-services.util"
import { requireAuthToken } from "../utils/user-id.util"

export interface StaticProfile {
  interests: string[]
  skills: string[]
  profession?: string
  demographics?: {
    age_range?: string
    location?: string
    education?: string
  }
  long_term_patterns: string[]
  domains: string[]
  expertise_areas: string[]
  personality_traits?: string[]
  work_style?: {
    preferred_work_hours?: string
    collaboration_style?: string
    decision_making_style?: string
    problem_solving_approach?: string
  }
  communication_style?: {
    preferred_channels?: string[]
    communication_frequency?: string
    tone_preference?: string
  }
  learning_preferences?: {
    preferred_learning_methods?: string[]
    learning_pace?: string
    knowledge_retention_style?: string
  }
  values_and_priorities?: string[]
  technology_preferences?: {
    preferred_tools?: string[]
    tech_comfort_level?: string
    preferred_platforms?: string[]
  }
  lifestyle_patterns?: {
    activity_level?: string
    social_patterns?: string
    productivity_patterns?: string
  }
  cognitive_style?: {
    thinking_pattern?: string
    information_processing?: string
    creativity_level?: string
  }
  personal_narrative?: {
    who?: string
    why?: string
    what?: string
    how?: string
  }
}

export interface DynamicProfile {
  recent_activities: string[]
  current_projects: string[]
  temporary_interests: string[]
  recent_changes: string[]
  current_context: string[]
  active_goals?: string[]
  current_challenges?: string[]
  recent_achievements?: string[]
  current_focus_areas?: string[]
  emotional_state?: {
    current_concerns?: string[]
    current_excitements?: string[]
    stress_level?: string
  }
  active_research_topics?: string[]
  upcoming_events?: string[]
}

export interface UserProfile {
  id: string
  user_id: string
  static_profile: {
    json: StaticProfile
    text: string | null
  }
  dynamic_profile: {
    json: DynamicProfile
    text: string | null
  }
  last_updated: string
  last_memory_analyzed: string | null
  version: number
}

export interface ProfileResponse {
  success: boolean
  data: {
    profile: UserProfile | null
    message?: string
  }
}

export async function getProfile(): Promise<UserProfile | null> {
  requireAuthToken()

  try {
    const response = await getRequest("/profile")

    if (response.data?.success === false) {
      console.error("API error:", response.data?.error)
      throw new Error(response.data?.error || "API returned error")
    }

    return response.data?.data?.profile || null
  } catch (error) {
    console.error("Error fetching profile:", error)
    throw error
  }
}

export async function refreshProfile(): Promise<UserProfile> {
  requireAuthToken()

  try {
    const response = await postRequest(
      "/profile/refresh",
      {},
      undefined,
      undefined,
      300000
    )

    if (response.data?.success === false) {
      console.error("API error:", response.data?.error)
      throw new Error(response.data?.error || "API returned error")
    }

    return response.data?.data?.profile
  } catch (error) {
    console.error("Error refreshing profile:", error)
    throw error
  }
}

export async function getProfileContext(): Promise<string> {
  requireAuthToken()

  try {
    const response = await getRequest("/profile/context")

    if (response.data?.success === false) {
      console.error("API error:", response.data?.error)
      throw new Error(response.data?.error || "API returned error")
    }

    return response.data?.data?.context || ""
  } catch (error) {
    console.error("Error fetching profile context:", error)
    return ""
  }
}
