import type { Expense, GameConsole, GameSession, Payment, SessionExtension, Setting, TariffPlan, UserAction } from '../domain'
import { db } from '../db'

export interface BackupData {
  consoles: GameConsole[]
  sessions: GameSession[]
  sessionExtensions: SessionExtension[]
  tariffPlans: TariffPlan[]
  payments: Payment[]
  expenses: Expense[]
  settings: Setting[]
  userActions?: UserAction[]
}

export interface AppBackup {
  app: 'compubac-gaming'
  schemaVersion: 1
  exportedAt?: string
  data: BackupData
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const hasString = (row: Record<string, unknown>, key: string) => typeof row[key] === 'string'
const hasFiniteNumber = (row: Record<string, unknown>, key: string) => typeof row[key] === 'number' && Number.isFinite(row[key])
const rows = (data: Record<string, unknown>, key: keyof BackupData) => {
  const value = data[key]
  if (!Array.isArray(value) || !value.every(isRecord)) throw new Error(`La sección «${key}» debe contener una lista de registros.`)
  return value
}

export function parseBackup(value: unknown): AppBackup {
  if (!isRecord(value) || value.app !== 'compubac-gaming' || value.schemaVersion !== 1 || !isRecord(value.data)) {
    throw new Error('El archivo no es un respaldo compatible de CompuBac Gaming.')
  }
  const data = value.data
  const consoles = rows(data, 'consoles') as unknown as GameConsole[]
  const sessions = rows(data, 'sessions') as unknown as GameSession[]
  const extensions = rows(data, 'sessionExtensions') as unknown as SessionExtension[]
  const tariffs = rows(data, 'tariffPlans') as unknown as TariffPlan[]
  const payments = rows(data, 'payments') as unknown as Payment[]
  const expenses = rows(data, 'expenses') as unknown as Expense[]
  const settings = rows(data, 'settings') as unknown as Setting[]
  const userActions = data.userActions === undefined ? undefined : rows(data, 'userActions') as unknown as UserAction[]

  const uniqueIds = (items: Array<{ id: string }>, label: string) => {
    const ids = items.map(item => item.id)
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) throw new Error(`La sección «${label}» contiene identificadores vacíos o repetidos.`)
  }
  for (const [name, items] of Object.entries({ consoles, sessions, extensions, tariffs, payments, expenses, ...(userActions ? { userActions } : {}) })) uniqueIds(items as Array<{ id: string }>, name)
  if (settings.some(setting => !hasString(setting as unknown as Record<string, unknown>, 'key') || !setting.key || !['string', 'number', 'boolean'].includes(typeof setting.value) || (typeof setting.value === 'number' && !Number.isFinite(setting.value))) || new Set(settings.map(setting => setting.key)).size !== settings.length) throw new Error('La sección «settings» contiene claves o valores no válidos.')

  if (consoles.some(item => !hasString(item as unknown as Record<string, unknown>, 'name') || !item.name.trim() || !hasString(item as unknown as Record<string, unknown>, 'type') || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'hourlyRate') || item.hourlyRate < 0 || (item.sortOrder !== undefined && (!hasFiniteNumber(item as unknown as Record<string, unknown>, 'sortOrder') || item.sortOrder < 0)) || typeof item.active !== 'boolean' || !['available', 'occupied', 'service'].includes(item.status))) throw new Error('Hay una consola con nombre, tipo, tarifa u orden no válido.')
  const consoleIds = new Set(consoles.map(item => item.id))
  const sessionIds = new Set(sessions.map(item => item.id))
  if (sessions.some(item => !consoleIds.has(item.consoleId) || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'startedAt') || (item.endedAt !== undefined && !hasFiniteNumber(item as unknown as Record<string, unknown>, 'endedAt')) || (item.durationMinutes !== undefined && (!hasFiniteNumber(item as unknown as Record<string, unknown>, 'durationMinutes') || item.durationMinutes <= 0)) || (item.initialDurationMinutes !== undefined && (!hasFiniteNumber(item as unknown as Record<string, unknown>, 'initialDurationMinutes') || item.initialDurationMinutes <= 0)) || (item.transferStartedAt !== undefined && !hasFiniteNumber(item as unknown as Record<string, unknown>, 'transferStartedAt')) || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'rate') || item.rate < 0 || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'amount') || item.amount < 0 || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'paidAmount') || item.paidAmount < 0 || !['active', 'completed', 'cancelled'].includes(item.status) || !['prepaid', 'open'].includes(item.mode))) throw new Error('Hay una sesión con datos no válidos o sin consola asociada.')
  if (payments.some(item => !sessionIds.has(item.sessionId) || !consoleIds.has(item.consoleId) || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'amount') || item.amount < 0 || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'createdAt') || (item.paidAt !== undefined && !hasFiniteNumber(item as unknown as Record<string, unknown>, 'paidAt')) || !hasString(item as unknown as Record<string, unknown>, 'concept') || !['paid', 'pending', 'void'].includes(item.status) || !['cash', 'transfer'].includes(item.method))) throw new Error('Hay un pago con datos no válidos o sin sesión o consola asociada.')
  if (extensions.some(item => !sessionIds.has(item.sessionId) || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'minutes') || item.minutes <= 0 || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'amount') || item.amount < 0 || (item.additionalCharge !== undefined && (!hasFiniteNumber(item as unknown as Record<string, unknown>, 'additionalCharge') || item.additionalCharge < 0)) || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'createdAt'))) throw new Error('Hay una extensión no válida o sin sesión asociada.')
  if (tariffs.some(item => !hasString(item as unknown as Record<string, unknown>, 'label') || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'minutes') || item.minutes <= 0 || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'ps2Price') || item.ps2Price < 0 || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'xboxPrice') || item.xboxPrice < 0)) throw new Error('Hay un paquete de tarifa con datos no válidos.')
  if (expenses.some(item => !hasString(item as unknown as Record<string, unknown>, 'concept') || !item.concept.trim() || !hasString(item as unknown as Record<string, unknown>, 'date') || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !hasFiniteNumber(item as unknown as Record<string, unknown>, 'amount') || item.amount <= 0 || !['fixed', 'variable'].includes(item.type))) throw new Error('Hay un gasto con concepto, fecha o importe no válido.')

  if (userActions?.some(action => !hasString(action as unknown as Record<string, unknown>, 'action') || !hasString(action as unknown as Record<string, unknown>, 'entity') || !hasString(action as unknown as Record<string, unknown>, 'summary') || !hasFiniteNumber(action as unknown as Record<string, unknown>, 'timestamp'))) throw new Error('La sección «userActions» contiene acciones no válidas.')
  return { app: 'compubac-gaming', schemaVersion: 1, ...(typeof value.exportedAt === 'string' ? { exportedAt: value.exportedAt } : {}), data: { consoles, sessions, sessionExtensions: extensions, tariffPlans: tariffs, payments, expenses, settings, ...(userActions ? { userActions } : {}) } }
}

export async function createBackup() {
  const data: BackupData = {
    consoles: await db.consoles.toArray(),
    sessions: await db.sessions.toArray(),
    sessionExtensions: await db.sessionExtensions.toArray(),
    tariffPlans: await db.tariffPlans.toArray(),
    payments: await db.payments.toArray(),
    expenses: await db.expenses.toArray(),
    settings: await db.settings.toArray(),
    userActions: await db.userActions.toArray(),
  }
  return { app: 'compubac-gaming' as const, schemaVersion: 1 as const, exportedAt: new Date().toISOString(), data }
}

export async function restoreBackup(backup: AppBackup) {
  await db.transaction('rw', db.tables, async () => {
    await db.consoles.clear(); if (backup.data.consoles.length) await db.consoles.bulkAdd(backup.data.consoles)
    await db.sessions.clear(); if (backup.data.sessions.length) await db.sessions.bulkAdd(backup.data.sessions)
    await db.sessionExtensions.clear(); if (backup.data.sessionExtensions.length) await db.sessionExtensions.bulkAdd(backup.data.sessionExtensions)
    await db.tariffPlans.clear(); if (backup.data.tariffPlans.length) await db.tariffPlans.bulkAdd(backup.data.tariffPlans)
    await db.payments.clear(); if (backup.data.payments.length) await db.payments.bulkAdd(backup.data.payments)
    await db.expenses.clear(); if (backup.data.expenses.length) await db.expenses.bulkAdd(backup.data.expenses)
    await db.settings.clear(); if (backup.data.settings.length) await db.settings.bulkAdd(backup.data.settings)
    if (backup.data.userActions) { await db.userActions.clear(); if (backup.data.userActions.length) await db.userActions.bulkAdd(backup.data.userActions) }
  })
}
