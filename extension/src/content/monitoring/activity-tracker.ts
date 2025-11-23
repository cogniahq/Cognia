let lastActivityTime = Date.now()
let hasUserActivity = false
let activityLevel: 'high' | 'normal' | 'low' = 'normal'

export function updateActivityLevel() {
  const now = Date.now()
  const timeSinceLastActivity = now - lastActivityTime
  if (timeSinceLastActivity < 15000) {
    activityLevel = 'high'
  } else if (timeSinceLastActivity < 120000) {
    activityLevel = 'normal'
  } else {
    activityLevel = 'low'
  }
}

export function getActivityLevel(): 'high' | 'normal' | 'low' {
  return activityLevel
}

export function markUserActivity() {
  hasUserActivity = true
  lastActivityTime = Date.now()
}

export function hasActivity(): boolean {
  return hasUserActivity
}

export function resetActivity() {
  hasUserActivity = false
}

export function getLastActivityTime(): number {
  return lastActivityTime
}

export function getMonitoringInterval(): number {
  switch (activityLevel) {
    case 'high':
      return 10000
    case 'normal':
      return 20000
    case 'low':
      return 60000
    default:
      return 20000
  }
}
