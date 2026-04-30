import test from 'node:test'
import assert from 'node:assert/strict'

import { startProfileWorker } from './profile-worker'
import { profileUpdateService } from '../services/profile/profile-update.service'
import { backgroundGenerationPriorityService } from '../services/core/background-generation-priority.service'

test('profile worker defers updates while search priority is active', async () => {
  const originalGetUsersNeedingUpdateByHours = profileUpdateService.getUsersNeedingUpdateByHours
  const originalUpdateUserProfile = profileUpdateService.updateUserProfile
  const originalShouldDeferBackgroundGeneration =
    backgroundGenerationPriorityService.shouldDeferBackgroundGeneration

  let updateCalls = 0

  profileUpdateService.getUsersNeedingUpdateByHours = (async (): Promise<string[]> => [
    'user-1',
    'user-2',
  ]) as typeof profileUpdateService.getUsersNeedingUpdateByHours
  profileUpdateService.updateUserProfile = (async (): Promise<void> => {
    updateCalls++
  }) as unknown as typeof profileUpdateService.updateUserProfile
  backgroundGenerationPriorityService.shouldDeferBackgroundGeneration =
    (async (): Promise<boolean> =>
      true) as typeof backgroundGenerationPriorityService.shouldDeferBackgroundGeneration

  try {
    const result = await startProfileWorker(7, 1)

    assert.deepEqual(result, {
      updated: 0,
      failed: 0,
      skipped: 2,
    })
    assert.equal(updateCalls, 0)
  } finally {
    profileUpdateService.getUsersNeedingUpdateByHours = originalGetUsersNeedingUpdateByHours
    profileUpdateService.updateUserProfile = originalUpdateUserProfile
    backgroundGenerationPriorityService.shouldDeferBackgroundGeneration =
      originalShouldDeferBackgroundGeneration
  }
})
