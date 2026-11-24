import Dexie, { type Table } from 'dexie'
import { initialConsoles, initialTariffs, type Expense, type FileHandleRecord, type GameConsole, type GameSession, type Payment, type SessionExtension, type Setting, type TariffPlan, type UserAction } from './domain'

class GameHubDB extends Dexie {
  consoles!: Table<GameConsole, string>; sessions!: Table<GameSession, string>; sessionExtensions!: Table<SessionExtension, string>
  tariffPlans!: Table<TariffPlan, string>; payments!: Table<Payment, string>; expenses!: Table<Expense, string>; settings!: Table<Setting, string>
  userActions!: Table<UserAction, string>; fileHandles!: Table<FileHandleRecord, string>
  constructor() {
    super('gamehub-local')
    this.version(1).stores({ consoles: 'id, type, status, active', sessions: 'id, consoleId, startedAt, status', sessionExtensions: 'id, sessionId, createdAt', tariffPlans: 'id, minutes', payments: 'id, sessionId, consoleId, createdAt, status', expenses: 'id, category, date', settings: 'key' })
    this.version(2).stores({ consoles: 'id, type, status, active', sessions: 'id, consoleId, startedAt, status', sessionExtensions: 'id, sessionId, createdAt', tariffPlans: 'id, minutes', payments: 'id, sessionId, consoleId, createdAt, status', expenses: 'id, category, date', settings: 'key', userActions: 'id, timestamp, action, entity, entityId', fileHandles: 'id' })
    this.version(3).stores({ consoles: 'id, type, status, active', sessions: 'id, consoleId, startedAt, status', sessionExtensions: 'id, sessionId, createdAt', tariffPlans: 'id, minutes', payments: 'id, sessionId, consoleId, createdAt, status', expenses: 'id, category, date', settings: 'key', userActions: 'id, timestamp, action, entity, entityId', fileHandles: 'id' }).upgrade(async transaction => {
      const table = transaction.table('consoles')
      const rows = await table.toArray() as GameConsole[]
      await Promise.all(rows.map((consoleInfo, sortOrder) => table.update(consoleInfo.id, { sortOrder })))
    })
  }
}
export const db = new GameHubDB()
export async function initializeDatabase() {
  await db.transaction('rw', db.consoles, db.tariffPlans, db.settings, async () => {
    if ((await db.consoles.count()) === 0) await db.consoles.bulkAdd(initialConsoles)
    if ((await db.tariffPlans.count()) === 0) await db.tariffPlans.bulkAdd(initialTariffs)
    const defaults = [
      { key: 'currency', value: 'MXN' },
      { key: 'timezone', value: 'America/Mexico_City' },
      { key: 'rounding', value: 'minute' },
    ]
    for (const setting of defaults) {
      if (!(await db.settings.get(setting.key))) await db.settings.add(setting)
    }
  })
}
