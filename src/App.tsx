import { useMemo, useState } from 'react'
import { BarChart3, CalendarClock, LayoutDashboard, Moon, Settings2, SlidersHorizontal, Sun } from 'lucide-react'
import { db } from './db'
import { consoleCatalog, formatMoney, type Expense, type GameConsole, type GameSession, type Payment, type PaymentMethod } from './domain'
import { tariffPrice } from './domain/pricing'
import { createBackup, parseBackup, restoreBackup } from './data/backup'
import { exportCsv } from './data/exports'
import { recordUserAction } from './data/audit'
import { connectAuditCsv, downloadAuditCsv, requestAuditCsvPermission } from './data/auditCsv'
import { cancelSession as cancelStoredSession, deleteSessionRecords, extendSession, finishSession, getSessionRelatedCounts, markPaymentPaid as markStoredPaymentPaid, SessionConflictError, startSession, updateCompletedSession } from './data/sessionOperations'
import Calculator from './Calculator'
import { DialogView, type AppDialog } from './shared/AppDialog'
import { downloadFile } from './shared/downloadFile'
import { FinancePage } from './features/finance/FinancePage'
import { SessionsPage } from './features/sessions/SessionsPage'
import { SessionEditorDialog } from './features/sessions/SessionEditorDialog'
import { ConsoleDialog } from './features/consoles/ConsoleDialog'
import { ExpenseDialog } from './features/finance/ExpenseDialog'
import { SessionDialog } from './features/sessions/SessionDialog'
import type { SessionModal } from './features/sessions/SessionDialog'
import { DashboardPage } from './features/consoles/DashboardPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { useGameData } from './hooks/useGameData'

type Modal = SessionModal | null
const parseDateTimeInput = (value:string) => { const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value); if (!match) return NaN; const [, year, month, day, hour, minute] = match; const y=Number(year), mo=Number(month), d=Number(day), h=Number(hour), mi=Number(minute); const date = new Date(y, mo-1, d, h, mi); return date.getFullYear()===y && date.getMonth()===mo-1 && date.getDate()===d && date.getHours()===h && date.getMinutes()===mi ? date.getTime() : NaN }
const nav = [{ label: 'Consolas', icon: LayoutDashboard }, { label: 'Sesiones', icon: CalendarClock }, { label: 'Finanzas', icon: BarChart3 }, { label: 'Calculadora', icon: SlidersHorizontal }]
const localDateValue=()=>{const date=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}

export default function App() {
  const { consoles, sessions, payments, tariffs, expenses, now, loaded, loadError, theme, setTheme, refresh, loadApplication, toggleTheme, auditStatus, setAuditStatus } = useGameData()
  const [modal, setModal] = useState<Modal>(null), [page, setPage] = useState('Consolas')
  const [appDialog, setAppDialog] = useState<AppDialog|null>(null)
  const [addingConsole,setAddingConsole] = useState(false)
  const [addingExpense,setAddingExpense] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [editingRate, setEditingRate] = useState<string | null>(null), [rateDraft, setRateDraft] = useState('')
  const [sessionToEdit, setSessionToEdit] = useState<GameSession|null>(null)
  const showMessageDialog = (title:string, message:string) => new Promise<void>(resolve => setAppDialog({ kind:'message', title, message, resolve }))
  const askConfirmation = (title:string, message:string, confirmLabel='Confirmar', destructive=false) => new Promise<boolean>(resolve => setAppDialog({ kind:'confirm', title, message, confirmLabel, destructive, resolve }))
  const askForText = (title:string, message:string, label:string, placeholder:string, submitLabel:string) => new Promise<string|null>(resolve => setAppDialog({ kind:'text', title, message, label, placeholder, submitLabel, resolve }))
  const resolveAppDialog = (value?:boolean|string|null) => { const current=appDialog; if (!current) return; setAppDialog(null); if(current.kind==='message') current.resolve(); else if(current.kind==='confirm') current.resolve(value===true); else current.resolve(typeof value==='string'?value:null) }
  const activeSessions = sessions.filter(s => s.status === 'active')
  const activeByConsole = useMemo(() => new Map(activeSessions.map(s => [s.consoleId, s])), [sessions])
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayPayments = payments.filter(p => p.status === 'paid' && (p.paidAt ?? p.createdAt) >= todayStart.getTime())
  const todayIncome = todayPayments.reduce((sum, p) => sum + p.amount, 0)
  const completedToday = sessions.filter(s => s.status === 'completed' && (s.endedAt ?? 0) >= todayStart.getTime())
  const hoursToday = (startedAt: number, endedAt: number) => Math.max(0, Math.min(endedAt, now) - Math.max(startedAt, todayStart.getTime())) / 3600000
  const todayHours = sessions.filter(s => s.status === 'completed' && (s.endedAt ?? 0) >= todayStart.getTime()).reduce((n, s) => n + hoursToday(s.startedAt, s.endedAt ?? now), 0) + activeSessions.reduce((n, s) => n + hoursToday(s.startedAt, now), 0)
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6)
  const begin = async (input: { duration: number; mode: GameSession['mode']; paid: boolean }) => {
    if (!modal || modal.kind !== 'start') return
    try {
      await startSession({ consoleInfo: modal.console, durationMinutes: input.duration, mode: input.mode, amount: input.mode === 'prepaid' ? tariffPrice(modal.console, input.duration, tariffs) : 0, paid: input.paid, method })
      setModal(null); await refresh()
    } catch (error) { await showMessageDialog('No se pudo iniciar', error instanceof SessionConflictError ? error.message : 'Ocurrió un error al iniciar la sesión. Inténtalo de nuevo.') }
  }
  const finish = async (s: GameSession, paid: boolean) => {
    try { await finishSession({ session: s, paid, method }); setModal(null); await refresh() }
    catch (error) { await showMessageDialog('No se pudo finalizar', error instanceof SessionConflictError ? error.message : 'Ocurrió un error al finalizar la sesión. Inténtalo de nuevo.') }
  }
  const extend = async (s: GameSession, c: GameConsole) => {
    try { await extendSession(s, tariffPrice(c, 30, tariffs), method); await refresh() }
    catch (error) { await showMessageDialog('No se pudo extender', error instanceof SessionConflictError ? error.message : 'Ocurrió un error al extender la sesión. Inténtalo de nuevo.') }
  }
  const updateRate = async (c: GameConsole) => { const n = Number(rateDraft); if (rateDraft.trim()==='' || !Number.isFinite(n) || n < 0) { await showMessageDialog('Tarifa no válida', 'Escribe un importe igual o mayor que cero.'); return } await db.transaction('rw', db.consoles, db.userActions, async () => { await db.consoles.update(c.id, { hourlyRate: n }); await recordUserAction({ action: 'console.rate.updated', entity: 'console', entityId: c.id, summary: `Actualizó la tarifa de ${c.name}.`, details: JSON.stringify({ hourlyRate: n }) }) }); setEditingRate(null); await refresh() }
  const addConsole = async (input: { name: string; type: string; rate: string }) => {
    const rate=Number(input.rate), catalogEntry=consoleCatalog.find(group=>group.models.includes(input.type))
    if(!catalogEntry){await showMessageDialog('Elige un modelo','Selecciona un tipo de consola del catálogo.');return}
    if(input.rate.trim()===''||!Number.isFinite(rate)||rate<0){await showMessageDialog('Tarifa no válida','Escribe una tarifa igual o mayor que cero.');return}
    const duplicates=consoles.filter(c=>c.type===input.type).length, name=input.name.trim()||`${input.type}${duplicates?` · ${duplicates+1}`:''}`
    const consoleRecord:GameConsole={id:crypto.randomUUID(),name,type:input.type,category:catalogEntry.category,hourlyRate:rate,status:'available',active:true}
    await db.transaction('rw', db.consoles, db.userActions, async () => { await db.consoles.add(consoleRecord); await recordUserAction({ action: 'console.created', entity: 'console', entityId: consoleRecord.id, summary: `Agregó la consola ${consoleRecord.name}.`, details: JSON.stringify({ type: consoleRecord.type, hourlyRate: rate }) }) });setAddingConsole(false);await refresh()
  }
  const openAddConsole=()=>setAddingConsole(true)
  const addExpense = async (input: Omit<Expense, 'id'>) => {
    const concept=input.concept.trim(),amount=input.amount
    if(!concept){await showMessageDialog('Falta el concepto','Escribe una descripción para el gasto.');return}
    const dateMatch=/^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date)
    const parsedDate=dateMatch?new Date(Number(dateMatch[1]),Number(dateMatch[2])-1,Number(dateMatch[3])):null
    if(!parsedDate||parsedDate.getFullYear()!==Number(dateMatch?.[1])||parsedDate.getMonth()!==Number(dateMatch?.[2])-1||parsedDate.getDate()!==Number(dateMatch?.[3])){await showMessageDialog('Fecha no válida','Elige una fecha válida para el gasto.');return}
    if(!Number.isFinite(amount)||amount<=0){await showMessageDialog('Importe no válido','El importe debe ser mayor que cero.');return}
    const record:Expense={...input,id:crypto.randomUUID(),concept,...(input.notes?.trim()?{notes:input.notes.trim()}: {})}
    await db.transaction('rw', db.expenses, db.userActions, async () => { await db.expenses.add(record); await recordUserAction({ action: 'expense.created', entity: 'expense', entityId: record.id, summary: `Registró el gasto ${record.concept}.`, details: JSON.stringify({ amount, category: record.category, date: record.date, type: record.type }) }) });setAddingExpense(false);await refresh()
  }
  const markPaymentPaid = async (payment:Payment) => {
    try { await markStoredPaymentPaid(payment.id); await refresh() }
    catch (error) { await showMessageDialog('No se pudo registrar el pago', error instanceof SessionConflictError ? error.message : 'Ocurrió un error al actualizar el pago.') }
  }
  const applyHourlyPrice = async (price:number) => {
    if(!Number.isFinite(price)||price<0)return
    const active=consoles.filter(c=>c.active).length
    if(!await askConfirmation('Aplicar precio objetivo',`Se cambiará la tarifa por hora de ${active} consolas activas a ${formatMoney(price)}. Las sesiones anteriores conservarán sus tarifas.`, 'Aplicar tarifas'))return
    await db.transaction('rw',db.consoles,db.userActions,async()=>{await db.consoles.toCollection().modify(c=>{if(c.active)c.hourlyRate=price});await recordUserAction({action:'console.rates.applied',entity:'console',summary:`Aplicó ${formatMoney(price)} por hora a las consolas activas.`,details:JSON.stringify({hourlyRate:price,count:active})})})
    await refresh();await showMessageDialog('Tarifas actualizadas',`Las consolas activas ahora cobran ${formatMoney(price)} por hora.`)
  }
  const cancelSession = async (s: GameSession, c: GameConsole) => { const reason = (await askForText('Cancelar sesión', `Escribe por qué se cancela la sesión de ${c.name}.`, 'Motivo', 'Motivo de cancelación', 'Cancelar sesión'))?.trim(); if (!reason) return; try { await cancelStoredSession(s.id, reason); await refresh() } catch (error) { await showMessageDialog('No se pudo cancelar', error instanceof SessionConflictError ? error.message : 'Ocurrió un error al cancelar la sesión.') } }
  const exportBackup = async () => {
    const backup = await createBackup()
    await db.transaction('rw', db.userActions, async () => { await recordUserAction({ action: 'backup.exported', entity: 'backup', summary: 'Descargó un respaldo completo.' }) })
    downloadFile(`compubac-respaldo-${localDateValue()}.json`, 'application/json;charset=utf-8', JSON.stringify(backup, null, 2))
    await refresh()
  }
  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      if (!await askConfirmation('Restaurar respaldo', 'Se reemplazarán todos los registros actuales con los del archivo seleccionado. Esta acción no se puede deshacer.', 'Restaurar', true)) return
      await restoreBackup(backup)
      await db.transaction('rw', db.userActions, async () => { await recordUserAction({ action: 'backup.restored', entity: 'backup', summary: 'Restauró un respaldo completo.' }) })
      const savedTheme = await db.settings.get('uiTheme')
      if (savedTheme?.value === 'dark' || savedTheme?.value === 'light') setTheme(savedTheme.value)
      await refresh()
      await showMessageDialog('Respaldo restaurado', 'Los registros se restauraron correctamente.')
    } catch (error) {
      const message = error instanceof SyntaxError ? 'El archivo seleccionado no contiene JSON válido.' : error instanceof Error && (error.message.startsWith('El archivo no es un respaldo') || error.message.startsWith('La sección') || error.message.startsWith('Hay una') || error.message.startsWith('La sección')) ? error.message : 'No se pudo restaurar el respaldo. Revisa el archivo e inténtalo de nuevo.'
      await showMessageDialog('No se pudo restaurar', message)
    }
  }
  const connectAuditFile = async () => {
    try { setAuditStatus(await connectAuditCsv()) }
    catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setAuditStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo vincular el archivo CSV.' })
    }
  }
  const requestAuditPermission = async () => {
    try { setAuditStatus(await requestAuditCsvPermission()) }
    catch (error) { setAuditStatus({ kind: 'error', message: error instanceof Error ? error.message : 'No se pudo abrir el archivo CSV.' }) }
  }
  const exportActionsCsv = async () => {
    await exportCsv(consoles)
    await db.transaction('rw', db.userActions, async () => { await recordUserAction({ action: 'records.exported', entity: 'export', summary: 'Descargó los registros del negocio en CSV.' }) })
    await refresh()
  }
  const downloadActionsCsv = async () => {
    await db.transaction('rw', db.userActions, async () => { await recordUserAction({ action: 'audit.exported', entity: 'audit', summary: 'Descargó la bitácora local de acciones.' }) })
    await downloadAuditCsv()
    await refresh()
  }
  const openSessionEditor = (session: GameSession) => setSessionToEdit(session)
  const saveSessionEdit = async (input: { consoleId: string; startedAt: string; endedAt: string; rate: string; amount: string }) => {
    if (!sessionToEdit) return
    const start = parseDateTimeInput(input.startedAt), end = parseDateTimeInput(input.endedAt), rate = Number(input.rate), amount = Number(input.amount)
    if (!Number.isFinite(start)) { await showMessageDialog('Revisa la sesión', 'La fecha y hora de inicio no son válidas.'); return }
    if (!Number.isFinite(end)) { await showMessageDialog('Revisa la sesión', 'La fecha y hora de finalización no son válidas.'); return }
    if (end <= start) { await showMessageDialog('Revisa la sesión', 'La hora de finalización debe ser posterior a la hora de inicio.'); return }
    if (input.rate.trim()==='' || !Number.isFinite(rate) || rate < 0) { await showMessageDialog('Revisa la tarifa', 'Escribe un importe igual o mayor que cero.'); return }
    if (input.amount.trim()==='' || !Number.isFinite(amount) || amount < 0) { await showMessageDialog('Revisa el importe', 'Escribe un importe igual o mayor que cero.'); return }
    const amountChanged = amount !== sessionToEdit.amount
    try {
      await updateCompletedSession({ session: sessionToEdit, consoleId: input.consoleId, startedAt: start, endedAt: end, rate, amount, amountChanged })
    } catch (error) {
      await showMessageDialog('No se pudo guardar', error instanceof SessionConflictError ? error.message : 'Ocurrió un error al actualizar la sesión. Inténtalo de nuevo.')
      return
    }
    setSessionToEdit(null); await refresh()
  }
  const deleteSession = async (session: GameSession, consoleName: string) => {
    const related = await getSessionRelatedCounts(session.id)
    const message = `¿Eliminar la sesión de ${consoleName}? También se eliminarán ${related.payments} pagos y ${related.extensions} extensiones vinculados.${session.status==='active'?' La consola quedará disponible.':''} Esta acción no se puede deshacer.`
    if (!await askConfirmation('Eliminar sesión', message, 'Eliminar sesión', true)) return
    await deleteSessionRecords(session.id)
    await refresh()
  }
  if (!loaded) return <main className="loading">Preparando tu espacio…</main>
  if (loadError) return <main className="loading"><p role="alert">{loadError}</p><button className="button backup-primary" onClick={() => void loadApplication()}>Intentar de nuevo</button></main>
  return <div className="shell" data-theme={theme}>
    <aside className="sidebar">
      <div className="brand"><img className="brand-wordmark" src="/brand/compubac-hero-mark.png" alt="CompuBac"/><img className="brand-symbol" src="/brand/compubac-favicon.png" alt=""/><div className="brand-caption">GAMING</div></div>
      <div className="nav-label">OPERACIÓN</div><nav>{nav.map(item => <button key={item.label} className={`nav-item ${page === item.label ? 'selected' : ''}`} onClick={() => setPage(item.label)}><item.icon size={17}/>{item.label}{item.label === 'Consolas' && activeSessions.length > 0 && <span className="nav-count">{activeSessions.length}</span>}</button>)}</nav>
      <div className="nav-label lower-label">SISTEMA</div><button className={`nav-item ${page === 'Configuración' ? 'selected' : ''}`} onClick={() => setPage('Configuración')}><Settings2 size={17}/>Configuración</button>
      <div className="sidebar-bottom"><div className="profile"><div className="profile-avatar">M</div><div><b>MacHip3r</b><small>Administrador</small></div></div></div>
    </aside>
    <main className="main-area"><header className="topbar"><div className="breadcrumb">CompuBac <span>/</span> {page}</div><div className="top-actions"><button className="icon-btn theme-toggle" onClick={toggleTheme} aria-label={theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'} title={theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><div className="top-avatar">M</div></div></header>
      <div className="content">
        <div className="page-heading"><div><div className="eyebrow">{new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).format(now).toUpperCase()}</div><h1>{page === 'Consolas' ? 'Control de consolas' : page === 'Calculadora' ? 'Calculadora de rentabilidad' : page}</h1><p>{page === 'Consolas' ? 'Todo listo para tu siguiente partida.' : 'Resumen y administración de tu negocio.'}</p></div>{page === 'Consolas' && <button className="button secondary" onClick={() => setPage('Configuración')}><Settings2 size={16}/> Gestionar consolas</button>}</div>
        {page === 'Consolas' && <DashboardPage
          consoles={consoles} payments={payments} activeSessions={activeSessions} activeByConsole={activeByConsole}
          todayStart={todayStart} todayIncome={todayIncome} todayPayments={todayPayments} completedToday={completedToday}
          todayHours={todayHours} recent={recent} now={now} onNavigate={setPage}
          onStart={consoleInfo => setModal({ kind: 'start', console: consoleInfo })}
          onFinish={(session, consoleInfo) => setModal({ kind: 'finish', session, console: consoleInfo })}
          onExtend={extend} onCancel={cancelSession}
        />}
        {page === 'Sesiones' && <SessionsPage sessions={sessions} consoles={consoles} onFinish={(session, consoleInfo) => setModal({ kind: 'finish', session, console: consoleInfo })} onEdit={openSessionEditor} onDelete={deleteSession} />}
        {page === 'Finanzas' && <FinancePage payments={payments} sessions={sessions} expenses={expenses} onMarkPaid={markPaymentPaid} onAddExpense={() => setAddingExpense(true)} />}
        {page === 'Configuración' && <SettingsPage consoles={consoles} tariffs={tariffs} editingRate={editingRate} rateDraft={rateDraft}
          onAddConsole={openAddConsole} onRateDraftChange={setRateDraft} onSaveRate={updateRate}
          onEditRate={consoleInfo => { setEditingRate(consoleInfo.id); setRateDraft(String(consoleInfo.hourlyRate)) }}
          onCancelRateEdit={() => setEditingRate(null)} onExportCsv={exportActionsCsv} onExportBackup={exportBackup} onImportBackup={importBackup}
          auditStatus={auditStatus} onConnectAuditCsv={connectAuditFile} onRequestAuditPermission={requestAuditPermission} onDownloadAuditCsv={downloadActionsCsv}
        />}
        {page === 'Calculadora' && <Calculator consoles={consoles} sessions={sessions} payments={payments} expenses={expenses} onApply={applyHourlyPrice} />}
        <footer className="footer"><span>CompuBac Gaming <b>·</b> Versión 0.1</span></footer>
      </div>
    </main>
    {modal && <SessionDialog modal={modal} now={now} tariffs={tariffs} method={method} onMethodChange={setMethod}
      onClose={() => setModal(null)} onBegin={begin} onFinish={finish}
    />}
    {sessionToEdit && <SessionEditorDialog session={sessionToEdit} consoles={consoles}
      onClose={() => setSessionToEdit(null)} onSave={saveSessionEdit}
    />}
    {addingConsole && <ConsoleDialog
      onClose={() => setAddingConsole(false)} onSubmit={addConsole}
    />}
    {addingExpense && <ExpenseDialog
      onClose={() => setAddingExpense(false)} onSubmit={addExpense}
    />}
    {appDialog && <DialogView dialog={appDialog} onResolve={resolveAppDialog}/>}
  </div>
}
