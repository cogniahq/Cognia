import { logger } from '../../utils/core/logger.util'
import type {
  ProfileExtractionResult,
  StaticProfile,
  DynamicProfile,
} from '../../types/profile.types'

export class ProfileParserService {
  parseProfileResponse(response: string): ProfileExtractionResult {
    let jsonStr = this.extractJsonString(response)

    if (!jsonStr) {
      throw new Error('No JSON found in response')
    }

    let data

    try {
      data = JSON.parse(jsonStr)
    } catch {
      try {
        jsonStr = this.fixJson(jsonStr)
        data = JSON.parse(jsonStr)
      } catch {
        try {
          jsonStr = this.fixJsonAdvanced(jsonStr)
          data = JSON.parse(jsonStr)
        } catch (thirdError) {
          const errorMessage = thirdError instanceof Error ? thirdError.message : String(thirdError)
          logger.error('Error parsing profile response after fixes:', {
            error: errorMessage,
            errorType: thirdError?.constructor?.name || 'Unknown',
          })
          logger.error('JSON string (first 1000 chars):', jsonStr.substring(0, 1000))
          logger.error(
            'JSON string (last 500 chars):',
            jsonStr.substring(Math.max(0, jsonStr.length - 500))
          )
          throw new Error(`Failed to parse JSON after fixes: ${errorMessage}`)
        }
      }
    }

    // Require at least static_profile_json, make dynamic optional with fallback
    if (!data.static_profile_json) {
      logger.warn('Invalid profile structure: missing static_profile_json', {
        hasStatic: !!data.static_profile_json,
        hasDynamic: !!data.dynamic_profile_json,
        dataKeys: Object.keys(data),
      })
      throw new Error('Invalid profile structure: missing static_profile_json')
    }

    // If dynamic_profile_json is missing, create an empty one
    if (!data.dynamic_profile_json) {
      logger.warn('Missing dynamic_profile_json, using empty default', {
        dataKeys: Object.keys(data),
      })
      data.dynamic_profile_json = {
        recent_activities: [],
        current_projects: [],
        temporary_interests: [],
        recent_changes: [],
        current_context: [],
        active_goals: [],
        current_challenges: [],
        recent_achievements: [],
        current_focus_areas: [],
        emotional_state: {},
        active_research_topics: [],
        upcoming_events: [],
      }
    }

    return {
      static_profile_json: data.static_profile_json as StaticProfile,
      static_profile_text: data.static_profile_text || '',
      dynamic_profile_json: data.dynamic_profile_json as DynamicProfile,
      dynamic_profile_text: data.dynamic_profile_text || '',
    }
  }

  private extractJsonString(response: string): string | null {
    const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch && jsonMatch[1]) {
      return jsonMatch[1]
    }

    const firstBrace = response.indexOf('{')
    if (firstBrace === -1) {
      return null
    }

    let braceCount = 0
    let inString = false
    let escapeNext = false
    let lastValidBrace = -1

    for (let i = firstBrace; i < response.length; i++) {
      const char = response[i]

      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        continue
      }

      if (char === '"' && !escapeNext) {
        inString = !inString
        continue
      }

      if (inString) {
        continue
      }

      if (char === '{') {
        braceCount++
        lastValidBrace = i
      } else if (char === '}') {
        braceCount--
        if (braceCount === 0) {
          return response.substring(firstBrace, i + 1)
        }
        lastValidBrace = i
      }
    }

    if (lastValidBrace > firstBrace) {
      return response.substring(firstBrace, lastValidBrace + 1)
    }

    return null
  }

  private fixJson(jsonStr: string): string {
    let fixed = jsonStr

    fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    const textFields = ['static_profile_text', 'dynamic_profile_text']
    for (const field of textFields) {
      const regex = new RegExp(`"${field}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, 'g')
      fixed = fixed.replace(regex, (match, value) => {
        const escaped = value
          .replace(/\\\\/g, '\\')
          .replace(/\\"/g, '"')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t')
        return `"${field}": "${escaped}"`
      })
    }

    fixed = fixed.replace(/:\s*"([^"]*(?:\\.[^"]*)*)"\s*([,}\]])/g, (match, value, end) => {
      if (value.includes('"') && !value.match(/\\"/)) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `: "${escaped}"${end}`
      }
      return match
    })

    return fixed
  }

  private fixJsonAdvanced(jsonStr: string): string {
    let fixed = jsonStr

    fixed = fixed.replace(/,(\s*[}\]])/g, '$1')

    fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    const lastBrace = fixed.lastIndexOf('}')
    if (lastBrace !== -1 && lastBrace < fixed.length - 1) {
      fixed = fixed.substring(0, lastBrace + 1)
    }

    fixed = this.escapeUnescapedQuotesInStrings(fixed)

    return fixed
  }

  private escapeUnescapedQuotesInStrings(jsonStr: string): string {
    let result = ''
    let inString = false
    let escapeNext = false

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i]

      if (escapeNext) {
        result += char
        escapeNext = false
        continue
      }

      if (char === '\\') {
        result += char
        escapeNext = true
        continue
      }

      if (char === '"') {
        if (!inString) {
          inString = true
          result += char
        } else {
          const nextChar = i + 1 < jsonStr.length ? jsonStr[i + 1] : ''
          if (
            nextChar === ':' ||
            nextChar === ',' ||
            nextChar === '}' ||
            nextChar === ']' ||
            nextChar === '\n' ||
            nextChar === '\r' ||
            nextChar === ' '
          ) {
            inString = false
            result += char
          } else {
            result += '\\"'
          }
        }
      } else {
        result += char
      }
    }

    return result
  }
}

export const profileParserService = new ProfileParserService()
