import Dexie, { type Table } from 'dexie'
import { initialConsoles, initialTariffs, type Expense, type GameConsole, type GameSession, type Payment, type SessionExtension, type Setting, type TariffPlan } from './domain'

class GameHubDB extends Dexie {
  consoles!: Table<GameConsole, string>; sessions!: Table<GameSession, string>; sessionExtensions!: Table<SessionExtension, string>
  tariffPlans!: Table<TariffPlan, string>; payments!: Table<Payment, string>; expenses!: Table<Expense, string>; settings!: Table<Setting, string>
  constructor() {
    super('gamehub-local')
    this.version(1).stores({ consoles: 'id, type, status, active', sessions: 'id, consoleId, startedAt, status', sessionExtensions: 'id, sessionId, createdAt', tariffPlans: 'id, minutes', payments: 'id, sessionId, consoleId, createdAt, status', expenses: 'id, category, date', settings: 'key' })
  }
}
export const db = new GameHubDB()
export async function initializeDatabase() {
  await db.transaction('rw', db.consoles, db.tariffPlans, db.settings, async () => {
    if ((await db.consoles.count()) === 0) await db.consoles.bulkAdd(initialConsoles)
    if ((await db.tariffPlans.count()) === 0) await db.tariffPlans.bulkAdd(initialTariffs)
    if (!(await db.settings.get('currency'))) await db.settings.bulkAdd([{ key: 'currency', value: 'MXN' }, { key: 'timezone', value: 'America/Mexico_City' }, { key: 'rounding', value: 'minute' }])
  })
}
