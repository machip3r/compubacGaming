import { db } from '../db'
import { downloadFile } from '../shared/downloadFile'

export async function exportCsv() {
  const [consoles, sessions, payments, extensions, expenses, tariffs, settings, actions] = await Promise.all([
    db.consoles.toArray(), db.sessions.toArray(), db.payments.toArray(), db.sessionExtensions.toArray(),
    db.expenses.toArray(), db.tariffPlans.toArray(), db.settings.toArray(), db.userActions.toArray(),
  ])
  const consolesById = new Map(consoles.map(consoleInfo => [consoleInfo.id, consoleInfo.name]))
  const header = ['tipo','id','fecha','consola','sesion','concepto','duracion_minutos','importe_mxn','cobrado_mxn','tarifa_hora_mxn','metodo_pago','estado','notas','detalles']
  const rows: unknown[][] = [
    ...consoles.map(consoleInfo => ['consola',consoleInfo.id,'',consoleInfo.name,'',consoleInfo.type,'',consoleInfo.hourlyRate,'','','',`${consoleInfo.active?'activa':'inactiva'} · ${consoleInfo.status}`,'',JSON.stringify({ category: consoleInfo.category, sortOrder: consoleInfo.sortOrder })]),
    ...sessions.map(session => ['sesión',session.id,new Date(session.startedAt).toISOString(),consolesById.get(session.consoleId) ?? session.consoleId,session.id,`${session.mode === 'prepaid' ? 'Prepago' : 'Tiempo libre'}${session.endedAt ? ` · fin ${new Date(session.endedAt).toISOString()}` : ''}`,session.endedAt ? Math.round((session.endedAt-session.startedAt)/60000) : session.initialDurationMinutes ?? session.durationMinutes,session.amount,session.paidAmount,session.rate,session.paymentMethod,session.status,session.cancelReason ?? '',JSON.stringify({ transferStartedAt: session.transferStartedAt, remainingMinutes: session.status==='active'?session.durationMinutes:undefined })]),
    ...payments.map(payment => ['pago',payment.id,new Date(payment.status === 'paid' ? (payment.paidAt ?? payment.createdAt) : payment.createdAt).toISOString(),consolesById.get(payment.consoleId) ?? payment.consoleId,payment.sessionId,payment.concept,'',payment.amount,payment.status === 'paid' ? payment.amount : 0,'',payment.method,payment.status,'','']),
    ...extensions.map(extension => ['extensión',extension.id,new Date(extension.createdAt).toISOString(),'','',`Extensión de sesión ${extension.sessionId}`,extension.minutes,extension.amount,'','','','registrada','','']),
    ...expenses.map(expense => ['gasto',expense.id,expense.date,'','',expense.concept,'',expense.amount,'','','',expense.type,expense.notes ?? '','']),
    ...tariffs.map(tariff => ['tarifa',tariff.id,'','','',tariff.label,tariff.minutes,tariff.ps2Price,'','','','activa','',JSON.stringify({ xboxPrice: tariff.xboxPrice })]),
    ...settings.map(setting => ['configuración',setting.key,'','','',setting.key,'','','','','','guardada','',String(setting.value)]),
    ...actions.map(action => ['acción',action.id,new Date(action.timestamp).toISOString(),action.entity==='console'&&action.entityId?consolesById.get(action.entityId)??action.entityId:'',action.entity==='session'?action.entityId??'':'',action.summary,'','','','','',action.action,action.entity,JSON.stringify({ entityId: action.entityId, details: action.details })]),
  ]
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  downloadFile(`compubac-registros-${localDateValue()}.csv`, 'text/csv;charset=utf-8', `\uFEFF${csv}`)
}

function localDateValue() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
