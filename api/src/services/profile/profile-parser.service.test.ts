import test from 'node:test'
import assert from 'node:assert/strict'

import { profileParserService } from './profile-parser.service'

test('repairs missing commas between top-level profile sections', () => {
  const malformedResponse = `{
  "static_profile_json": {
    "interests": ["software development"],
    "skills": ["resume writing"],
    "profession": "software developer and job seeker",
    "long_term_patterns": ["consistently applying for jobs"],
    "domains": ["software engineering"],
    "expertise_areas": ["technical writing"],
    "personal_narrative": {
      "who": "Viraj is a software developer and job seeker.",
      "why": "They want to land a strong role.",
      "what": "They spend time applying and preparing.",
      "how": "They work in a structured and iterative way."
    }
  },
  "static_profile_text": "Viraj is organized and goal-driven."
  "dynamic_profile_json": {
    "recent_activities": ["submitted job applications"],
    "current_projects": ["resume refresh"],
    "temporary_interests": ["job search strategy"],
    "recent_changes": ["updated resume"],
    "current_context": ["actively interviewing"],
    "active_goals": ["land a software role"]
  }
  "dynamic_profile_text": "Viraj is focused on job search execution right now."
}`

  const parsed = profileParserService.parseProfileResponse(malformedResponse)

  assert.deepEqual(parsed.static_profile_json.interests, ['software development'])
  assert.deepEqual(parsed.dynamic_profile_json.current_projects, ['resume refresh'])
  assert.equal(parsed.dynamic_profile_text, 'Viraj is focused on job search execution right now.')
})
