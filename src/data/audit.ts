import { db } from '../db'
import type { UserAction } from '../domain'

export type UserActionInput = Omit<UserAction, 'id' | 'timestamp'> & { timestamp?: number }

export function recordUserAction(action: UserActionInput) {
  const record: UserAction = {
    ...action,
    id: crypto.randomUUID(),
    timestamp: action.timestamp ?? Date.now(),
  }
  return db.userActions.add(record)
}
