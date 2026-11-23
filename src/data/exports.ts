import { db } from '../db'
import type { GameConsole } from '../domain'
import { downloadFile } from '../shared/downloadFile'

export async function exportCsv(consoles: GameConsole[]) {
  const [sessions, payments, extensions, expenses] = await Promise.all([
    db.sessions.toArray(), db.payments.toArray(), db.sessionExtensions.toArray(), db.expenses.toArray(),
  ])
  const consolesById = new Map(consoles.map(consoleInfo => [consoleInfo.id, consoleInfo.name]))
  const header = ['tipo','id','fecha','consola','sesion','concepto','duracion_minutos','importe_mxn','cobrado_mxn','tarifa_hora_mxn','metodo_pago','estado','notas']
  const rows: unknown[][] = [
    ...sessions.map(session => ['sesión',session.id,new Date(session.startedAt).toISOString(),consolesById.get(session.consoleId) ?? session.consoleId,session.id,`${session.mode === 'prepaid' ? 'Prepago' : 'Tiempo libre'}${session.endedAt ? ` · fin ${new Date(session.endedAt).toISOString()}` : ''}`,session.endedAt ? Math.round((session.endedAt-session.startedAt)/60000) : session.durationMinutes,session.amount,session.paidAmount,session.rate,session.paymentMethod,session.status,session.cancelReason ?? '']),
    ...payments.map(payment => ['pago',payment.id,new Date(payment.status === 'paid' ? (payment.paidAt ?? payment.createdAt) : payment.createdAt).toISOString(),consolesById.get(payment.consoleId) ?? payment.consoleId,payment.sessionId,payment.concept,'',payment.amount,payment.status === 'paid' ? payment.amount : 0,'',payment.method,payment.status,'']),
    ...extensions.map(extension => ['extensión',extension.id,new Date(extension.createdAt).toISOString(),'','',`Extensión de sesión ${extension.sessionId}`,extension.minutes,extension.amount,'','','','registrada','']),
    ...expenses.map(expense => ['gasto',expense.id,expense.date,'','',expense.concept,'',expense.amount,'','','',expense.type,expense.notes ?? '']),
  ]
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  downloadFile(`compubac-registros-${localDateValue()}.csv`, 'text/csv;charset=utf-8', `\uFEFF${csv}`)
}

function localDateValue() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
