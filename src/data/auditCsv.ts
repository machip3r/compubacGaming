import { db } from '../db'
import type { FileHandleRecord, UserAction } from '../domain'
import { recordUserAction } from './audit'
import { downloadFile } from '../shared/downloadFile'

const handleId = 'user-actions-csv'
const headers = ['id', 'timestamp', 'action', 'entity', 'entityId', 'summary', 'details']
let syncTask: Promise<AuditFileStatus> | null = null

export type AuditFileStatus =
  | { kind: 'unsupported' }
  | { kind: 'unlinked' }
  | { kind: 'permission-required'; fileName: string }
  | { kind: 'ready'; fileName: string; imported: number }
  | { kind: 'error'; message: string }

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options?: {
    suggestedName?: string
    types?: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle>
}

type AuditableHandle = FileSystemFileHandle & {
  queryPermission: (descriptor?: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission: (descriptor?: { mode: 'readwrite' }) => Promise<PermissionState>
}

export async function connectAuditCsv() {
  const picker = (window as FilePickerWindow).showSaveFilePicker
  if (!picker) throw new Error('Este navegador no permite vincular un CSV local. Las acciones seguirán guardándose dentro de la aplicación.')
  const handle = await picker({
    suggestedName: 'compubac-sessions.csv',
    types: [{ description: 'Archivo CSV', accept: { 'text/csv': ['.csv'] } }],
  })
  await db.fileHandles.put({ id: handleId, handle } satisfies FileHandleRecord)
  await db.transaction('rw', db.userActions, async () => {
    await recordUserAction({ action: 'audit_file.connected', entity: 'audit', summary: 'Vinculó el archivo local de acciones.', details: JSON.stringify({ fileName: handle.name }) })
  })
  return syncAuditCsv(true)
}

export async function requestAuditCsvPermission() {
  const record = await db.fileHandles.get(handleId)
  if (!record) return { kind: 'unlinked' } as const
  const handle = record.handle as AuditableHandle
  const permission = await handle.requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') return { kind: 'permission-required', fileName: handle.name } as const
  return syncAuditCsv()
}

export async function downloadAuditCsv() {
  const actions = await db.userActions.orderBy('timestamp').toArray()
  downloadFile('compubac-sessions.csv', 'text/csv;charset=utf-8', serializeAuditCsv(actions))
}

export function syncAuditCsv(requestPermission = false): Promise<AuditFileStatus> {
  if (syncTask) return syncTask
  syncTask = syncAuditCsvInternal(requestPermission)
  return syncTask.finally(() => { syncTask = null })
}

async function syncAuditCsvInternal(requestPermission: boolean): Promise<AuditFileStatus> {
  if (!(window as FilePickerWindow).showSaveFilePicker) return { kind: 'unsupported' }
  const record = await db.fileHandles.get(handleId)
  if (!record) return { kind: 'unlinked' }
  const handle = record.handle as AuditableHandle
  let permission = await handle.queryPermission({ mode: 'readwrite' })
  if (permission === 'prompt' && requestPermission) permission = await handle.requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') return { kind: 'permission-required', fileName: handle.name }

  const file = await handle.getFile()
  const imported = parseAuditCsv(await file.text())
  const knownIds = new Set((await db.userActions.toCollection().primaryKeys()).map(String))
  const missingActions = imported.filter(action => !knownIds.has(action.id))
  if (missingActions.length) await db.userActions.bulkPut(missingActions)
  const allActions = await db.userActions.orderBy('timestamp').toArray()
  const content = serializeAuditCsv(allActions)
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
  return { kind: 'ready', fileName: handle.name, imported: missingActions.length }
}

function serializeAuditCsv(actions: UserAction[]) {
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = actions.map(action => [action.id, action.timestamp, action.action, action.entity, action.entityId ?? '', action.summary, action.details ?? ''])
  return `\uFEFF${[headers, ...rows].map(row => row.map(quote).join(',')).join('\r\n')}`
}

function parseAuditCsv(contents: string): UserAction[] {
  const rows = parseRows(contents.replace(/^\uFEFF/, ''))
  if (!rows.length) return []
  if (headers.some((header, index) => rows[0][index] !== header)) throw new Error('El CSV vinculado no tiene el formato de acciones de CompuBac Gaming.')
  const actions = rows.slice(1).filter(row => row.some(Boolean)).map((row, index) => {
    const [id, timestampText, action, entity, entityId, summary, details] = row
    const timestamp = Number(timestampText)
    if (!id || !Number.isFinite(timestamp) || !action || !entity || !summary) throw new Error(`El registro ${index + 2} del CSV tiene datos incompletos.`)
    return { id, timestamp, action, entity, ...(entityId ? { entityId } : {}), summary, ...(details ? { details } : {}) }
  })
  if (new Set(actions.map(action => action.id)).size !== actions.length) throw new Error('El CSV contiene identificadores de acción repetidos.')
  return actions
}

function parseRows(contents: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]
    if (quoted && char === '"' && contents[index + 1] === '"') { field += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { row.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && contents[index + 1] === '\n') index += 1
      row.push(field); rows.push(row); row = []; field = ''
    } else field += char
  }
  if (quoted) throw new Error('El archivo CSV tiene comillas sin cerrar.')
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
