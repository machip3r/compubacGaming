import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, BarChart3, CalendarClock, Check, CircleDollarSign, Clock3, CreditCard, Edit2, Gamepad2, LayoutDashboard, Moon, Plus, Settings2, SlidersHorizontal, Sun, TrendingUp, Trash2, Wallet, X } from 'lucide-react'
import { db, initializeDatabase } from './db'
import { consoleCatalog, elapsed, formatMoney, formatTime, openSessionAmount, prepaidAmount, type Expense, type GameConsole, type GameSession, type Payment, type PaymentMethod, type TariffPlan } from './domain'
import Calculator from './Calculator'

type Modal = { kind: 'start'; console: GameConsole } | { kind: 'finish'; console: GameConsole; session: GameSession } | null
type AppDialog =
  | { kind: 'message'; title: string; message: string; resolve: () => void }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; destructive?: boolean; resolve: (confirmed: boolean) => void }
  | { kind: 'text'; title: string; message: string; label: string; placeholder: string; submitLabel: string; resolve: (value: string | null) => void }
const toDateTimeInput = (timestamp: number) => { const date = new Date(timestamp), pad = (n:number) => String(n).padStart(2,'0'); return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}` }
const parseDateTimeInput = (value:string) => { const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value); if (!match) return NaN; const [, year, month, day, hour, minute] = match; const y=Number(year), mo=Number(month), d=Number(day), h=Number(hour), mi=Number(minute); const date = new Date(y, mo-1, d, h, mi); return date.getFullYear()===y && date.getMonth()===mo-1 && date.getDate()===d && date.getHours()===h && date.getMinutes()===mi ? date.getTime() : NaN }
const nav = [{ label: 'Consolas', icon: LayoutDashboard }, { label: 'Sesiones', icon: CalendarClock }, { label: 'Finanzas', icon: BarChart3 }, { label: 'Calculadora', icon: SlidersHorizontal }]
const timeLabel = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`
const tariffPrice = (consoleInfo:GameConsole, minutes:number, tariffs:TariffPlan[]) => { const plan=tariffs.find(t=>t.minutes===minutes); if(!plan)return prepaidAmount(consoleInfo.hourlyRate,minutes); const category=consoleInfo.category??(consoleInfo.type==='PS2'?'PlayStation':consoleInfo.type.toLowerCase().startsWith('xbox')?'XBOX':undefined); if(category==='PlayStation'&&consoleInfo.type==='PS2')return plan.ps2Price; if(category==='XBOX')return plan.xboxPrice; return prepaidAmount(consoleInfo.hourlyRate,minutes) }
const localDateValue=()=>{const date=new Date(),pad=(n:number)=>String(n).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}

export default function App() {
  const [consoles, setConsoles] = useState<GameConsole[]>([]), [sessions, setSessions] = useState<GameSession[]>([]), [payments, setPayments] = useState<Payment[]>([]), [tariffs, setTariffs] = useState<TariffPlan[]>([]), [expenses, setExpenses] = useState<Expense[]>([])
  const [now, setNow] = useState(Date.now()), [modal, setModal] = useState<Modal>(null), [page, setPage] = useState('Consolas'), [loaded, setLoaded] = useState(false), [theme, setTheme] = useState<'light'|'dark'>(()=>window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
  const [appDialog, setAppDialog] = useState<AppDialog|null>(null)
  const [duration, setDuration] = useState(60), [customDuration, setCustomDuration] = useState(45), [mode, setMode] = useState<'prepaid' | 'open'>('prepaid'), [method, setMethod] = useState<PaymentMethod>('cash'), [paid, setPaid] = useState(true)
  const [addingConsole,setAddingConsole] = useState(false), [newConsoleName,setNewConsoleName] = useState(''), [newConsoleType,setNewConsoleType] = useState('XBOX S'), [newConsoleRate,setNewConsoleRate] = useState('15')
  const [addingExpense,setAddingExpense] = useState(false), [expenseConcept,setExpenseConcept] = useState(''), [expenseCategory,setExpenseCategory] = useState<Expense['category']>('Otros'), [expenseAmount,setExpenseAmount] = useState(''), [expenseDate,setExpenseDate] = useState(localDateValue), [expenseType,setExpenseType] = useState<Expense['type']>('variable'), [expenseNotes,setExpenseNotes] = useState('')
  const [editingRate, setEditingRate] = useState<string | null>(null), [rateDraft, setRateDraft] = useState('')
  const backupInput = useRef<HTMLInputElement>(null)
  const [sessionToEdit, setSessionToEdit] = useState<GameSession|null>(null), [editConsoleId, setEditConsoleId] = useState(''), [editStartedAt, setEditStartedAt] = useState(''), [editEndedAt, setEditEndedAt] = useState(''), [editRate, setEditRate] = useState(''), [editAmount, setEditAmount] = useState('')
  const showMessageDialog = (title:string, message:string) => new Promise<void>(resolve => setAppDialog({ kind:'message', title, message, resolve }))
  const askConfirmation = (title:string, message:string, confirmLabel='Confirmar', destructive=false) => new Promise<boolean>(resolve => setAppDialog({ kind:'confirm', title, message, confirmLabel, destructive, resolve }))
  const askForText = (title:string, message:string, label:string, placeholder:string, submitLabel:string) => new Promise<string|null>(resolve => setAppDialog({ kind:'text', title, message, label, placeholder, submitLabel, resolve }))
  const resolveAppDialog = (value?:boolean|string|null) => { const current=appDialog; if (!current) return; setAppDialog(null); if(current.kind==='message') current.resolve(); else if(current.kind==='confirm') current.resolve(value===true); else current.resolve(typeof value==='string'?value:null) }
  const refresh = async () => { const [c, s, p, t, e] = await Promise.all([db.consoles.toArray(), db.sessions.toArray(), db.payments.toArray(), db.tariffPlans.toArray(), db.expenses.toArray()]); setConsoles(c); setSessions(s); setPayments(p); setTariffs(t); setExpenses(e) }
  useEffect(() => { initializeDatabase().then(async () => { const saved = await db.settings.get('uiTheme'); if (saved?.value === 'dark' || saved?.value === 'light') setTheme(saved.value); await refresh() }).finally(() => setLoaded(true)); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  const activeSessions = sessions.filter(s => s.status === 'active')
  const activeByConsole = useMemo(() => new Map(activeSessions.map(s => [s.consoleId, s])), [sessions])
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayPayments = payments.filter(p => p.status === 'paid' && (p.paidAt ?? p.createdAt) >= todayStart.getTime())
  const todayIncome = todayPayments.reduce((sum, p) => sum + p.amount, 0)
  const completedToday = sessions.filter(s => s.status === 'completed' && (s.endedAt ?? 0) >= todayStart.getTime())
  const todayHours = completedToday.reduce((n, s) => n + (s.endedAt! - s.startedAt) / 3600000, 0) + activeSessions.reduce((n, s) => n + (now - s.startedAt) / 3600000, 0)
  const recent = [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 6)
  const begin = async () => {
    if (!modal || modal.kind !== 'start') return
    const c = modal.console, startedAt = Date.now(), amount = mode === 'prepaid' ? tariffPrice(c, duration, tariffs) : 0
    const s: GameSession = { id: crypto.randomUUID(), consoleId: c.id, startedAt, durationMinutes: mode === 'prepaid' ? duration : undefined, rate: c.hourlyRate, mode, amount, status: 'active', paidAmount: paid && mode === 'prepaid' ? amount : 0, paymentMethod: method }
    await db.transaction('rw', db.sessions, db.consoles, db.payments, async () => {
      await db.sessions.add(s); await db.consoles.update(c.id, { status: 'occupied' })
      if (paid && amount > 0) await db.payments.add({ id: crypto.randomUUID(), sessionId: s.id, consoleId: c.id, createdAt: startedAt, paidAt: startedAt, concept: `Prepago · ${duration} min`, amount, method, status: 'paid' })
    })
    setModal(null); setDuration(60); await refresh()
  }
  const finish = async (s: GameSession, c: GameConsole) => {
    const endedAt = Date.now(), total = s.mode === 'prepaid' ? s.amount : openSessionAmount(s.rate, s.startedAt, endedAt, 'minute'), due = Math.max(0, total - s.paidAmount)
    await db.transaction('rw', db.sessions, db.consoles, db.payments, async () => {
      await db.sessions.update(s.id, { endedAt, amount: total, status: 'completed' }); await db.consoles.update(c.id, { status: 'available' })
      if (due > 0) await db.payments.add({ id: crypto.randomUUID(), sessionId: s.id, consoleId: c.id, createdAt: endedAt, ...(paid?{paidAt:endedAt}:{}), concept: `Cobro de sesión · ${c.name}`, amount: due, method, status: paid ? 'paid' : 'pending' })
    })
    setModal(null); await refresh()
  }
  const extend = async (s: GameSession, c: GameConsole) => {
    const mins = 30, amount = tariffPrice(c, mins, tariffs), createdAt = Date.now()
    await db.transaction('rw', db.sessions, db.sessionExtensions, db.payments, async () => {
      await db.sessions.update(s.id, { durationMinutes: (s.durationMinutes ?? 0) + mins, amount: s.amount + amount, paidAmount: s.paidAmount + amount })
      await db.sessionExtensions.add({ id: crypto.randomUUID(), sessionId: s.id, minutes: mins, amount, createdAt })
      await db.payments.add({ id: crypto.randomUUID(), sessionId: s.id, consoleId: c.id, createdAt, paidAt:createdAt, concept: 'Extensión · 30 min', amount, method, status: 'paid' })
    }); await refresh()
  }
  const updateRate = async (c: GameConsole) => { const n = Number(rateDraft); if (rateDraft.trim()==='' || !Number.isFinite(n) || n < 0) { await showMessageDialog('Tarifa no válida', 'Escribe un importe igual o mayor que cero.'); return } await db.consoles.update(c.id, { hourlyRate: n }); setEditingRate(null); await refresh() }
  const addConsole = async () => {
    const rate=Number(newConsoleRate), catalogEntry=consoleCatalog.find(group=>group.models.includes(newConsoleType))
    if(!catalogEntry){await showMessageDialog('Elige un modelo','Selecciona un tipo de consola del catálogo.');return}
    if(!Number.isFinite(rate)||rate<0){await showMessageDialog('Tarifa no válida','Escribe una tarifa igual o mayor que cero.');return}
    const duplicates=consoles.filter(c=>c.type===newConsoleType).length, name=newConsoleName.trim()||`${newConsoleType}${duplicates?` · ${duplicates+1}`:''}`
    const consoleRecord:GameConsole={id:crypto.randomUUID(),name,type:newConsoleType,category:catalogEntry.category,hourlyRate:rate,status:'available',active:true}
    await db.consoles.add(consoleRecord);setAddingConsole(false);setNewConsoleName('');await refresh()
  }
  const openAddConsole=()=>{setNewConsoleName('');setNewConsoleType('XBOX S');setNewConsoleRate('15');setAddingConsole(true)}
  const addExpense = async () => {
    const concept=expenseConcept.trim(),amount=Number(expenseAmount)
    if(!concept){await showMessageDialog('Falta el concepto','Escribe una descripción para el gasto.');return}
    if(!expenseDate||!Number.isFinite(Date.parse(`${expenseDate}T12:00:00`))){await showMessageDialog('Fecha no válida','Elige una fecha para el gasto.');return}
    if(expenseAmount.trim()===''||!Number.isFinite(amount)||amount<=0){await showMessageDialog('Importe no válido','El importe debe ser mayor que cero.');return}
    const record:Expense={id:crypto.randomUUID(),concept,category:expenseCategory,amount,date:expenseDate,type:expenseType,...(expenseNotes.trim()?{notes:expenseNotes.trim()}: {})}
    await db.expenses.add(record);setAddingExpense(false);setExpenseConcept('');setExpenseAmount('');setExpenseNotes('');setExpenseDate(localDateValue());await refresh()
  }
  const markPaymentPaid = async (payment:Payment) => {
    await db.transaction('rw',db.payments,db.sessions,async()=>{
      const current=await db.payments.get(payment.id);if(!current||current.status!=='pending')return
      const paidAt=Date.now()
      await db.payments.update(current.id,{status:'paid',paidAt})
      const session=await db.sessions.get(current.sessionId)
      if(session)await db.sessions.update(session.id,{paidAmount:session.paidAmount+current.amount})
    })
    await refresh()
  }
  const applyHourlyPrice = async (price:number) => {
    if(!Number.isFinite(price)||price<0)return
    const active=consoles.filter(c=>c.active).length
    if(!await askConfirmation('Aplicar precio objetivo',`Se cambiará la tarifa por hora de ${active} consolas activas a ${formatMoney(price)}. Las sesiones anteriores conservarán sus tarifas.`, 'Aplicar tarifas'))return
    await db.transaction('rw',db.consoles,async()=>{await db.consoles.toCollection().modify(c=>{if(c.active)c.hourlyRate=price})})
    await refresh();await showMessageDialog('Tarifas actualizadas',`Las consolas activas ahora cobran ${formatMoney(price)} por hora.`)
  }
  const cancelSession = async (s: GameSession, c: GameConsole) => { const reason = (await askForText('Cancelar sesión', `Escribe por qué se cancela la sesión de ${c.name}.`, 'Motivo', 'Motivo de cancelación', 'Cancelar sesión'))?.trim(); if (!reason) return; await db.transaction('rw', db.sessions, db.consoles, db.payments, async () => { await db.sessions.update(s.id, { status: 'cancelled', endedAt: Date.now(), cancelReason: reason }); await db.consoles.update(c.id, { status: 'available' }); await db.payments.where('sessionId').equals(s.id).modify({ status: 'void' }) }); await refresh() }
  const toggleTheme = async () => { const next = theme === 'light' ? 'dark' : 'light'; setTheme(next); await db.settings.put({ key: 'uiTheme', value: next }) }
  const exportBackup = async () => {
    const data = { consoles: await db.consoles.toArray(), sessions: await db.sessions.toArray(), sessionExtensions: await db.sessionExtensions.toArray(), tariffPlans: await db.tariffPlans.toArray(), payments: await db.payments.toArray(), expenses: await db.expenses.toArray(), settings: await db.settings.toArray() }
    downloadFile(`compubac-respaldo-${new Date().toISOString().slice(0,10)}.json`, 'application/json;charset=utf-8', JSON.stringify({ app: 'compubac-gaming', schemaVersion: 1, exportedAt: new Date().toISOString(), data }, null, 2))
  }
  const importBackup = async (file?: File) => {
    if (!file) return
    try {
      const backup = JSON.parse(await file.text()) as { app?: string; schemaVersion?: number; data?: Record<string, unknown> }
      const names = ['consoles','sessions','sessionExtensions','tariffPlans','payments','expenses','settings']
      if (backup.app !== 'compubac-gaming' || backup.schemaVersion !== 1 || !backup.data || names.some(name => !Array.isArray(backup.data?.[name]))) throw new Error('El archivo no es un respaldo compatible de CompuBac Gaming.')
      if (!await askConfirmation('Restaurar respaldo', 'Se reemplazarán todos los registros actuales con los del archivo seleccionado. Esta acción no se puede deshacer.', 'Restaurar', true)) return
      await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
          await table.clear()
          const rows = backup.data![table.name] as unknown[]
          if (rows.length) await table.bulkAdd(rows)
        }
      })
      const savedTheme = await db.settings.get('uiTheme')
      if (savedTheme?.value === 'dark' || savedTheme?.value === 'light') setTheme(savedTheme.value)
      await refresh()
      await showMessageDialog('Respaldo restaurado', 'Los registros se restauraron correctamente.')
    } catch (error) {
      const message = error instanceof SyntaxError ? 'El archivo seleccionado no contiene JSON válido.' : error instanceof Error && error.message === 'El archivo no es un respaldo compatible de CompuBac Gaming.' ? error.message : 'No se pudo restaurar el respaldo. Revisa el archivo e inténtalo de nuevo.'
      await showMessageDialog('No se pudo restaurar', message)
    }
  }
  const openSessionEditor = (session: GameSession) => { setSessionToEdit(session); setEditConsoleId(session.consoleId); setEditStartedAt(toDateTimeInput(session.startedAt)); setEditEndedAt(toDateTimeInput(session.endedAt ?? session.startedAt)); setEditRate(String(session.rate)); setEditAmount(String(session.amount)) }
  const saveSessionEdit = async () => {
    if (!sessionToEdit) return
    const start = parseDateTimeInput(editStartedAt), end = parseDateTimeInput(editEndedAt), rate = Number(editRate), amount = Number(editAmount)
    if (!Number.isFinite(start)) { await showMessageDialog('Revisa la sesión', 'La fecha y hora de inicio no son válidas.'); return }
    if (!Number.isFinite(end)) { await showMessageDialog('Revisa la sesión', 'La fecha y hora de finalización no son válidas.'); return }
    if (end <= start) { await showMessageDialog('Revisa la sesión', 'La hora de finalización debe ser posterior a la hora de inicio.'); return }
    if (editRate.trim()==='' || !Number.isFinite(rate) || rate < 0) { await showMessageDialog('Revisa la tarifa', 'Escribe un importe igual o mayor que cero.'); return }
    if (editAmount.trim()==='' || !Number.isFinite(amount) || amount < 0) { await showMessageDialog('Revisa el importe', 'Escribe un importe igual o mayor que cero.'); return }
    const related = await db.payments.where('sessionId').equals(sessionToEdit.id).toArray(), paidTotal = related.filter(p=>p.status==='paid').reduce((sum,p)=>sum+p.amount,0)
    if (amount < paidTotal) { await showMessageDialog('Importe menor al cobrado', `El total debe ser al menos ${formatMoney(paidTotal)}.`); return }
    const amountChanged = amount !== sessionToEdit.amount
    await db.transaction('rw', db.sessions, db.payments, async () => {
      await db.sessions.update(sessionToEdit.id, { consoleId: editConsoleId, startedAt: start, endedAt: end, rate, amount, paidAmount: paidTotal })
      await db.payments.where('sessionId').equals(sessionToEdit.id).modify({ consoleId: editConsoleId })
      if (amountChanged) {
        await db.payments.where({ sessionId: sessionToEdit.id, status: 'pending' }).modify({ status: 'void' })
        const due = Math.max(0, amount - paidTotal)
        if (due > 0) await db.payments.add({ id: crypto.randomUUID(), sessionId: sessionToEdit.id, consoleId: editConsoleId, createdAt: Date.now(), concept: 'Saldo ajustado al editar sesión', amount: due, method: sessionToEdit.paymentMethod ?? 'cash', status: 'pending' })
      }
    })
    setSessionToEdit(null); await refresh()
  }
  const deleteSession = async (session: GameSession, consoleName: string) => {
    const linkedPayments = await db.payments.where('sessionId').equals(session.id).count(), linkedExtensions = await db.sessionExtensions.where('sessionId').equals(session.id).count()
    const message = `¿Eliminar la sesión de ${consoleName}? También se eliminarán ${linkedPayments} pagos y ${linkedExtensions} extensiones vinculados.${session.status==='active'?' La consola quedará disponible.':''} Esta acción no se puede deshacer.`
    if (!await askConfirmation('Eliminar sesión', message, 'Eliminar sesión', true)) return
    await db.transaction('rw', db.sessions, db.payments, db.sessionExtensions, db.consoles, async () => {
      await db.payments.where('sessionId').equals(session.id).delete()
      await db.sessionExtensions.where('sessionId').equals(session.id).delete()
      await db.sessions.delete(session.id)
      if (session.status === 'active') await db.consoles.update(session.consoleId, { status: 'available' })
    })
    await refresh()
  }
  const exportCsv = async () => {
    const [allSessions, allPayments, extensions, expenses] = await Promise.all([db.sessions.toArray(), db.payments.toArray(), db.sessionExtensions.toArray(), db.expenses.toArray()])
    const consolesById = new Map(consoles.map(c => [c.id, c.name]))
    const header = ['tipo','id','fecha','consola','sesion','concepto','duracion_minutos','importe_mxn','cobrado_mxn','tarifa_hora_mxn','metodo_pago','estado','notas']
    const rows: unknown[][] = [
      ...allSessions.map(s => ['sesión',s.id,new Date(s.startedAt).toISOString(),consolesById.get(s.consoleId) ?? s.consoleId,s.id,`${s.mode === 'prepaid' ? 'Prepago' : 'Tiempo libre'}${s.endedAt ? ` · fin ${new Date(s.endedAt).toISOString()}` : ''}`,s.endedAt ? Math.round((s.endedAt-s.startedAt)/60000) : s.durationMinutes,s.amount,s.paidAmount,s.rate,s.paymentMethod,s.status,s.cancelReason ?? '']),
      ...allPayments.map(p => ['pago',p.id,new Date(p.status==='paid'?(p.paidAt??p.createdAt):p.createdAt).toISOString(),consolesById.get(p.consoleId) ?? p.consoleId,p.sessionId,p.concept,'',p.amount,p.status === 'paid' ? p.amount : 0,'',p.method,p.status,'']),
      ...extensions.map(x => ['extensión',x.id,new Date(x.createdAt).toISOString(),'','',`Extensión de sesión ${x.sessionId}`,x.minutes,x.amount,'','','','registrada','']),
      ...expenses.map(e => ['gasto',String(e.id ?? ''),String(e.date ?? ''),'','',String(e.concept ?? ''),'',e.amount ?? '', '', '', '',String(e.type ?? ''),String(e.notes ?? '')]),
    ]
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n')
    downloadFile(`compubac-registros-${new Date().toISOString().slice(0,10)}.csv`, 'text/csv;charset=utf-8', `\uFEFF${csv}`)
  }
  if (!loaded) return <main className="loading">Preparando tu espacio…</main>
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
        {page === 'Consolas' ? <>
          <section className="stats-grid"><Stat icon={<CircleDollarSign/>} label="Ingresos de hoy" value={formatMoney(todayIncome)} note={`${todayPayments.length} cobros registrados`} accent="green"/><Stat icon={<Gamepad2/>} label="Sesiones activas" value={String(activeSessions.length).padStart(2, '0')} note={`${consoles.filter(c => c.active && c.status === 'available').length} consolas disponibles`} accent="blue"/><Stat icon={<Clock3/>} label="Horas de juego" value={`${todayHours.toFixed(1)} h`} note="Tiempo acumulado hoy" accent="violet"/><Stat icon={<TrendingUp/>} label="Sesiones completadas" value={String(completedToday.length).padStart(2, '0')} note="Desde las 00:00 h" accent="amber"/></section>
          <section className="section-head"><div><h2>Estaciones</h2><p>Estado en tiempo real · Actualizado automáticamente</p></div></section>
          <section className="console-grid">{consoles.filter(c => c.active).map(c => { const s = activeByConsole.get(c.id), sec = s ? elapsed(s.startedAt, now) : 0, remain = s?.durationMinutes ? Math.max(0, s.durationMinutes * 60 - sec) : null, expired = remain !== null && remain === 0, warning = remain !== null && remain > 0 && remain <= 300; const charge = s ? (s.mode === 'prepaid' ? s.amount : openSessionAmount(s.rate, s.startedAt, now, 'minute')) : 0
            return <article className={`console-card ${s ? 'is-occupied' : ''} ${warning ? 'is-warning' : ''} ${expired ? 'is-expired' : ''}`} key={c.id}>
              <div className="card-top"><div className={`console-icon ${s ? 'on' : ''}`}><Gamepad2 size={20}/></div><span className={`status ${s ? expired ? 'red' : warning ? 'amber' : 'blue' : 'green'}`}><i/>{s ? expired ? 'Tiempo agotado' : warning ? 'Por terminar' : 'En uso' : 'Disponible'}</span></div>
              <div className="console-title"><h3>{c.name}</h3><span>{c.type} <b>·</b> {formatMoney(c.hourlyRate)}/hora</span></div>
              {s ? <><div className="timer-box"><div><span className="timer-label">{s.mode === 'prepaid' ? 'TIEMPO RESTANTE' : 'TIEMPO TRANSCURRIDO'}</span><strong className={expired ? 'timer-red' : ''}>{formatTime(s.mode === 'prepaid' ? remain! : sec)}</strong></div><div className="timer-side"><span>INICIO</span><b>{new Date(s.startedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</b></div></div>
                <div className="card-summary"><div><span>Importe</span><b>{formatMoney(charge)}</b></div><div><span>{s.mode === 'prepaid' ? 'Termina' : 'Modalidad'}</span><b>{s.mode === 'prepaid' ? new Date(s.startedAt + (s.durationMinutes ?? 0) * 60000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Tiempo libre'}</b></div></div>
                <div className="card-actions"><button className="button outline" onClick={() => extend(s, c)}><Plus size={15}/> +30 min</button><button className="button cancel-session icon-cancel" title="Cancelar sesión" aria-label="Cancelar sesión" onClick={() => cancelSession(s,c)}><X size={15}/></button><button className="button finish" onClick={() => { setModal({ kind: 'finish', console: c, session: s }); setPaid(true) }}><Check size={15}/> Finalizar</button></div></> : <><div className="available-body"><div className="available-orb"><Activity size={22}/></div><p>Lista para recibir<br/>una nueva sesión</p></div><button disabled={c.status === 'service'} className="button start-button" onClick={() => { setModal({ kind: 'start', console: c }); setDuration(60); setMode('prepaid'); setPaid(true) }}><Plus size={16}/> Iniciar sesión</button></>}
            </article>})}</section>
          <section className="bottom-grid"><div className="panel recent-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimas sesiones registradas</p></div><button className="text-button" onClick={() => setPage('Sesiones')}>Ver historial <span>→</span></button></div>{recent.length ? <div className="activity-list">{recent.map(s => { const c = consoles.find(x => x.id === s.consoleId); return <div className="activity-row" key={s.id}><div className="activity-icon"><Gamepad2 size={16}/></div><div className="activity-main"><b>{c?.name ?? 'Consola'}</b><span>{s.status === 'active' ? 'Sesión en curso' : s.status === 'completed' ? 'Sesión completada' : 'Sesión cancelada'} · {new Date(s.startedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></div><div className="activity-amount">{formatMoney(s.amount)}</div><span className={`mini-status ${s.status}`}>{s.status === 'active' ? 'Activa' : s.status === 'completed' ? 'Completada' : 'Cancelada'}</span></div>})}</div> : <div className="empty-activity"><div className="empty-icon"><CalendarClock size={19}/></div><b>Tu actividad aparecerá aquí</b><span>Inicia una sesión para comenzar a registrar movimientos.</span></div>}</div>
            <div className="panel quick-panel"><div className="panel-heading"><div><h2>Resumen del día</h2><p>Hoy, {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p></div><div className="summary-icon"><Wallet size={18}/></div></div><div className="summary-line"><span>Ingresos cobrados</span><b>{formatMoney(todayIncome)}</b></div><div className="summary-line"><span>Pagos pendientes</span><b>{formatMoney(payments.filter(p => p.status === 'pending' && p.createdAt >= todayStart.getTime()).reduce((n, p) => n + p.amount, 0))}</b></div><div className="summary-line"><span>Tiempo de juego</span><b>{timeLabel(Math.floor(todayHours * 3600))}</b></div><div className="summary-footer"><button className="text-button" onClick={() => setPage('Finanzas')}>Ver finanzas →</button></div></div></section>
        </> : page === 'Sesiones' ? <SessionsPage sessions={sessions} consoles={consoles} onFinish={(s,c) => { setModal({kind:'finish', session:s, console:c}); setPaid(true) }} onEdit={openSessionEditor} onDelete={deleteSession} /> : page === 'Finanzas' ? <FinancePage payments={payments} sessions={sessions} expenses={expenses} onMarkPaid={markPaymentPaid} onAddExpense={()=>{setExpenseDate(localDateValue());setAddingExpense(true)}} />  : page === 'Configuración' ? <><section className="panel settings-panel">
          <div className="panel-heading"><div><h2>Tarifas por estación</h2><p>El precio se conserva en las sesiones que ya comenzaron.</p></div><button className="button backup-primary" onClick={openAddConsole}><Plus size={16}/> Agregar consola</button></div>
          {consoles.map(c => <div className="rate-row" key={c.id}><div className="activity-icon"><Gamepad2 size={16}/></div><div><b>{c.name}</b><small>{c.category ?? (c.type==='PS2'?'PlayStation':'XBOX')} · {c.type}</small></div>{editingRate === c.id ? <div className="rate-editor"><span>$</span><input autoFocus value={rateDraft} onChange={e=>setRateDraft(e.target.value)} type="number" min="0"/><span>MXN / hora</span><button className="save-rate" onClick={()=>updateRate(c)}>Guardar</button><button className="cancel-rate" onClick={()=>setEditingRate(null)}><X size={15}/></button></div> : <><span className="rate-value">{formatMoney(c.hourlyRate)} <small>/ hora</small></span><button className="text-button" onClick={()=>{setEditingRate(c.id);setRateDraft(String(c.hourlyRate))}}>Editar tarifa</button></>}</div>)}
          <div className="settings-note">La tarifa vigente queda guardada en cada sesión para conservar el historial.</div>
          <div className="panel-heading tariff-heading"><div><h2>Paquetes sugeridos</h2><p>Tarifas de referencia por consola.</p></div></div><div className="tariff-grid">{tariffs.map(t=><div className="tariff" key={t.id}><b>{t.label}</b><span>PS2 <strong>{formatMoney(t.ps2Price)}</strong></span><span>Xbox <strong>{formatMoney(t.xboxPrice)}</strong></span></div>)}</div>
        </section><section className="panel backup-panel"><div className="backup-content"><div className="backup-copy-column"><div className="panel-heading"><div><h2>Registros y respaldos</h2><p>Descarga o restaura los datos del negocio.</p></div></div></div><div className="backup-actions"><button className="button backup-action-csv" onClick={exportCsv}><BarChart3 size={18}/><span><b>Descargar registros CSV</b><small>Sesiones, extensiones, pagos y gastos</small></span></button><button className="button backup-action-json" onClick={exportBackup}><Wallet size={18}/><span><b>Descargar respaldo completo</b><small>Incluye consolas, tarifas y configuración</small></span></button><button className="button backup-action-restore" onClick={()=>backupInput.current?.click()}><Activity size={18}/><span><b>Restaurar desde archivo</b><small>Reemplaza los datos tras confirmarlo</small></span></button><input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={e=>{void importBackup(e.currentTarget.files?.[0]);e.currentTarget.value=''}}/></div></div></section></> : <Calculator consoles={consoles} sessions={sessions} payments={payments} expenses={expenses} onApply={applyHourlyPrice}/>}
        <footer className="footer"><span>CompuBac Gaming <b>·</b> Versión 0.1</span></footer>
      </div>
    </main>
    {modal && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null)}}><div className="modal"><div className="modal-top"><div><span className="eyebrow">{modal.kind === 'start' ? 'NUEVA SESIÓN' : 'CIERRE DE SESIÓN'}</span><h2>{modal.kind === 'start' ? 'Iniciar sesión' : 'Finalizar sesión'}</h2></div><button className="icon-btn" onClick={()=>setModal(null)}><X size={18}/></button></div><div className="modal-console"><div className="console-icon on"><Gamepad2 size={19}/></div><div><b>{modal.console.name}</b><span>{formatMoney(modal.console.hourlyRate)} por hora</span></div></div>
      {modal.kind === 'start' ? <>
        <div className="field-label">Modalidad</div>
        <div className="segmented"><button className={mode==='prepaid'?'active':''} onClick={()=>setMode('prepaid')}><Clock3 size={16}/> Tiempo prepagado</button><button className={mode==='open'?'active':''} onClick={()=>setMode('open')}><Activity size={16}/> Tiempo libre</button></div>
        {mode==='prepaid' ? <>
          <div className="field-label">Elige la duración</div>
          <div className="duration-grid">{[30,60,120,180].map(min=><button key={min} className={`duration-option ${duration===min?'selected':''}`} onClick={()=>setDuration(min)}><b>{min<60?`${min} min`:`${min/60} ${min===60?'hora':'horas'}`}</b><span>{formatMoney(tariffPrice(modal.console,min,tariffs))}</span></button>)}<button className={`duration-option ${![30,60,120,180].includes(duration)?'selected':''}`} onClick={()=>setDuration(customDuration)}><b>Personalizado</b><span>Elegir tiempo</span></button><label className="custom-duration"><span className="field-label">Minutos</span><input aria-label="Minutos personalizados" type="number" min="1" max="720" disabled={[30,60,120,180].includes(duration)} value={customDuration} onChange={e=>{const minutes=Math.min(720,Math.max(1,Number(e.target.value)||1));setCustomDuration(minutes);setDuration(minutes)}}/></label></div>
          <div className="price-preview"><div><span>Total a cobrar</span><small>{duration} minutos · tarifa por paquete</small></div><b>{formatMoney(tariffPrice(modal.console,duration,tariffs))}</b></div>
          <div className="helper-note"><Clock3 size={15}/> Aviso visual 5 minutos antes; la sesión no termina sola.</div>
          <div className="field-label">Cobro inicial</div><div className="pay-choice"><button className={paid?'chosen':''} aria-pressed={paid} onClick={()=>setPaid(true)}>Cobrar ahora</button><button className={!paid?'chosen':''} aria-pressed={!paid} onClick={()=>setPaid(false)}>Dejar pendiente</button></div>
          {paid&&<div className="method-field"><div className="field-label">Método de pago</div><div className="pay-choice"><button type="button" className={method==='cash'?'chosen':''} aria-pressed={method==='cash'} onClick={()=>setMethod('cash')}>Efectivo</button><button type="button" className={method==='transfer'?'chosen':''} aria-pressed={method==='transfer'} onClick={()=>setMethod('transfer')}>Transferencia</button></div></div>}
          <button className="button modal-submit" onClick={begin}><Gamepad2 size={17}/> Iniciar sesión <span>·</span> {formatMoney(tariffPrice(modal.console,duration,tariffs))}</button>
        </> : <><div className="helper-note open-note"><Activity size={16}/> El cobro se calcula al finalizar, por minuto iniciado. No se registra ningún pago por adelantado.</div><div className="helper-note open-note"><Clock3 size={15}/> Aviso visual 5 minutos antes; la sesión no termina sola.</div><div className="open-rate"><span>Tarifa por hora</span><b>{formatMoney(modal.console.hourlyRate)}</b></div><button className="button modal-submit" onClick={begin}><Gamepad2 size={17}/> Iniciar sesión</button></>}
      </> : <><div className="finish-summary"><div><span>Duración jugada</span><b>{formatTime(elapsed(modal.session.startedAt, now))}</b></div><div><span>Importe total</span><b>{formatMoney(modal.session.mode==='prepaid'?modal.session.amount:openSessionAmount(modal.session.rate,modal.session.startedAt,now))}</b></div><div><span>Ya pagado</span><b>{formatMoney(modal.session.paidAmount)}</b></div><div className="due"><span>Saldo por cobrar</span><b>{formatMoney(Math.max(0,(modal.session.mode==='prepaid'?modal.session.amount:openSessionAmount(modal.session.rate,modal.session.startedAt,now))-modal.session.paidAmount))}</b></div></div><div className="field-label">Pago restante</div><div className="pay-choice"><button className={paid?'chosen':''} aria-pressed={paid} onClick={()=>setPaid(true)}>Cobrar ahora</button><button className={!paid?'chosen':''} aria-pressed={!paid} onClick={()=>setPaid(false)}>Dejar pendiente</button></div>{paid&&<div className="method-field"><div className="field-label">Método de pago</div><div className="pay-choice"><button type="button" className={method==='cash'?'chosen':''} aria-pressed={method==='cash'} onClick={()=>setMethod('cash')}>Efectivo</button><button type="button" className={method==='transfer'?'chosen':''} aria-pressed={method==='transfer'} onClick={()=>setMethod('transfer')}>Transferencia</button></div></div>}<button className="button modal-submit" onClick={()=>finish(modal.session,modal.console)}><Check size={16}/> Confirmar y liberar consola</button></>}
    </div></div>}
    {sessionToEdit && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSessionToEdit(null)}}><div className="modal edit-session-modal"><div className="modal-top"><div><span className="eyebrow">HISTORIAL</span><h2>Editar sesión</h2></div><button className="icon-btn" onClick={()=>setSessionToEdit(null)} aria-label="Cerrar"><X size={18}/></button></div><p className="edit-session-help">Ajusta los datos registrados. Si cambias el importe, el saldo pendiente se recalculará y quedará asentado.</p><label className="field-label" htmlFor="edit-console">Consola</label><select id="edit-console" className="edit-input" value={editConsoleId} onChange={e=>setEditConsoleId(e.target.value)}>{consoles.filter(c=>c.active).map(c=><option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}</select><label className="field-label" htmlFor="edit-start">Hora de inicio</label><input id="edit-start" className="edit-input" type="datetime-local" value={editStartedAt} onChange={e=>setEditStartedAt(e.target.value)}/><label className="field-label" htmlFor="edit-end">Hora de finalización</label><input id="edit-end" className="edit-input" type="datetime-local" value={editEndedAt} onChange={e=>setEditEndedAt(e.target.value)}/><div className="edit-numbers"><div><label className="field-label" htmlFor="edit-rate">Tarifa por hora</label><input id="edit-rate" className="edit-input" type="number" min="0" step="0.01" value={editRate} onChange={e=>setEditRate(e.target.value)}/></div><div><label className="field-label" htmlFor="edit-amount">Importe total</label><input id="edit-amount" className="edit-input" type="number" min="0" step="0.01" value={editAmount} onChange={e=>setEditAmount(e.target.value)}/></div></div><div className="edit-actions"><button className="button secondary" onClick={()=>setSessionToEdit(null)}>Volver</button><button className="button backup-primary" onClick={saveSessionEdit}><Check size={16}/> Guardar cambios</button></div></div></div>}
    {addingConsole && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAddingConsole(false)}}><section className="modal add-console-modal" role="dialog" aria-modal="true" aria-labelledby="add-console-title"><div className="modal-top"><div><span className="eyebrow">ESTACIONES</span><h2 id="add-console-title">Agregar consola</h2></div><button className="icon-btn" onClick={()=>setAddingConsole(false)} aria-label="Cerrar"><X size={18}/></button></div><p className="edit-session-help">Elige la plataforma y el modelo. Puedes darle un nombre propio para identificarla.</p><div className="model-preview"><div className="console-icon on"><Gamepad2 size={20}/></div><div><b>{newConsoleName.trim()||newConsoleType}</b><span>{consoleCatalog.find(group=>group.models.includes(newConsoleType))?.category} · {newConsoleType}</span></div></div><label className="field-label" htmlFor="new-console-type">Tipo de consola</label><select id="new-console-type" className="edit-input model-select" value={newConsoleType} onChange={e=>{setNewConsoleType(e.target.value);setNewConsoleRate(e.target.value==='PS2'?'10':'15')}}>{consoleCatalog.map(group=><optgroup key={group.category} label={group.category}>{group.models.map(model=><option key={model} value={model}>{model}</option>)}</optgroup>)}</select><label className="field-label" htmlFor="new-console-name">Nombre de estación <span className="optional-label">Opcional</span></label><input id="new-console-name" className="edit-input" maxLength={60} value={newConsoleName} placeholder={`Ej. ${newConsoleType} · Mostrador`} onChange={e=>setNewConsoleName(e.target.value)}/><label className="field-label console-rate-label" htmlFor="new-console-rate">Precio por hora</label><div className="money-input"><span>$</span><input id="new-console-rate" className="edit-input" type="number" min="0" step="0.01" value={newConsoleRate} onChange={e=>setNewConsoleRate(e.target.value)}/><span>MXN / hora</span></div><div className="edit-actions"><button className="button secondary" onClick={()=>setAddingConsole(false)}>Cancelar</button><button className="button backup-primary" onClick={addConsole}><Plus size={16}/> Agregar estación</button></div></section></div>}
    {addingExpense && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setAddingExpense(false)}}><section className="modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"><div className="modal-top"><div><span className="eyebrow">FINANZAS</span><h2 id="expense-title">Registrar gasto</h2></div><button className="icon-btn" onClick={()=>setAddingExpense(false)} aria-label="Cerrar"><X size={18}/></button></div><label className="field-label" htmlFor="expense-concept">Concepto</label><input id="expense-concept" className="edit-input" autoFocus maxLength={80} value={expenseConcept} placeholder="Ej. Recibo de electricidad" onChange={e=>setExpenseConcept(e.target.value)}/><div className="expense-fields"><div><label className="field-label" htmlFor="expense-category">Categoría</label><select id="expense-category" className="edit-input" value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value as Expense['category'])}>{['Renta','Electricidad','Internet','Mantenimiento','Controles y accesorios','Videojuegos','Suscripciones','Limpieza','Otros'].map(category=><option key={category}>{category}</option>)}</select></div><div><label className="field-label" htmlFor="expense-date">Fecha</label><input id="expense-date" className="edit-input" type="date" value={expenseDate} onChange={e=>setExpenseDate(e.target.value)}/></div><div><label className="field-label" htmlFor="expense-amount">Importe</label><input id="expense-amount" className="edit-input" type="number" min="0.01" step="0.01" value={expenseAmount} placeholder="0.00" onChange={e=>setExpenseAmount(e.target.value)}/></div><div><label className="field-label" htmlFor="expense-type">Tipo de gasto</label><select id="expense-type" className="edit-input" value={expenseType} onChange={e=>setExpenseType(e.target.value as Expense['type'])}><option value="fixed">Fijo</option><option value="variable">Variable</option></select></div></div><label className="field-label" htmlFor="expense-notes">Notas (opcional)</label><input id="expense-notes" className="edit-input" maxLength={180} value={expenseNotes} placeholder="Detalle adicional" onChange={e=>setExpenseNotes(e.target.value)}/><div className="edit-actions"><button className="button secondary" onClick={()=>setAddingExpense(false)}>Cancelar</button><button className="button backup-primary" onClick={addExpense}><Check size={16}/> Guardar gasto</button></div></section></div>}
    {appDialog && <DialogView dialog={appDialog} onResolve={resolveAppDialog}/>}
  </div>
}
function Stat({icon,label,value,note,accent}:{icon:React.ReactNode;label:string;value:string;note:string;accent:string}){return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}
function downloadFile(filename:string, mime:string, contents:string) { const url = URL.createObjectURL(new Blob([contents], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }
function DialogView({dialog,onResolve}:{dialog:AppDialog;onResolve:(value?:boolean|string|null)=>void}) {
  const [value,setValue]=useState('')
  const dialogRef=useRef<HTMLElement>(null)
  const dismiss=()=>onResolve(dialog.kind==='confirm'?false:dialog.kind==='text'?null:undefined)
  const submit=()=>dialog.kind==='text'?onResolve(value.trim()):dialog.kind==='confirm'?onResolve(true):onResolve()
  useEffect(()=>{
    const root=dialogRef.current
    if(!root)return
    const focusable=()=>Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])'))
    const initialFocus=root.querySelector<HTMLElement>('[autofocus]')
    if(initialFocus)initialFocus.focus();else focusable()[0]?.focus()
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();dismiss();return}
      if(event.key!=='Tab')return
      const items=focusable(); if(!items.length)return
      const first=items[0],last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    root.addEventListener('keydown',handleKeyDown)
    return ()=>root.removeEventListener('keydown',handleKeyDown)
  },[])
  return <div className="modal-backdrop app-dialog-layer" onMouseDown={e=>{if(e.target===e.currentTarget)dismiss()}}><section ref={dialogRef} className="modal app-dialog" role={dialog.kind==='text'?'dialog':'alertdialog'} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"><div className="modal-top"><h2 id="app-dialog-title">{dialog.title}</h2><button className="icon-btn" onClick={dismiss} aria-label="Cerrar diálogo"><X size={18}/></button></div><p className="app-dialog-message" id="app-dialog-message">{dialog.message}</p>{dialog.kind==='text'&&<div className="dialog-field"><label className="field-label" htmlFor="dialog-value">{dialog.label}</label><input id="dialog-value" className="edit-input" autoFocus maxLength={180} value={value} placeholder={dialog.placeholder} onChange={e=>setValue(e.target.value)}/></div>}<div className="edit-actions dialog-actions">{dialog.kind!=='message'&&<button className="button secondary" autoFocus={dialog.kind==='confirm'} onClick={dismiss}>Volver</button>}<button className={`button ${dialog.kind==='confirm'&&dialog.destructive?'dialog-danger':'backup-primary'}`} autoFocus={dialog.kind==='message'} disabled={dialog.kind==='text'&&!value.trim()} onClick={submit}>{dialog.kind==='message'?'Entendido':dialog.kind==='confirm'?dialog.confirmLabel:dialog.submitLabel}</button></div></section></div>
}
function SessionsPage({sessions,consoles,onFinish,onEdit,onDelete}:{sessions:GameSession[];consoles:GameConsole[];onFinish:(s:GameSession,c:GameConsole)=>void;onEdit:(s:GameSession)=>void;onDelete:(s:GameSession,consoleName:string)=>void}) {
  const [filter,setFilter]=useState('Todas')
  const items=[...sessions].sort((a,b)=>b.startedAt-a.startedAt).filter(s=>filter==='Todas'||(filter==='Activas'?s.status==='active':filter==='Completadas'?s.status==='completed':s.status==='cancelled'))
  return <div className="panel history-panel"><div className="panel-heading"><div><h2>Historial de sesiones</h2><p>{sessions.length} sesiones · Las completadas se pueden editar</p></div><select className="filter-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>Todas</option><option>Activas</option><option>Completadas</option><option value="Canceladas">Canceladas</option></select></div><div className="table-wrap"><table><thead><tr><th>CONSOLA</th><th>INICIO</th><th>FIN</th><th>DURACIÓN</th><th>IMPORTE</th><th>COBRADO</th><th>ESTADO</th><th>ACCIONES</th></tr></thead><tbody>{items.map(s=>{const c=consoles.find(x=>x.id===s.consoleId), consoleName=c?.name ?? 'Consola';return <tr key={s.id}><td><b>{consoleName}</b><small>{c?.type}</small></td><td>{new Date(s.startedAt).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>{s.endedAt?new Date(s.endedAt).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'—'}</td><td>{s.endedAt?timeLabel(Math.floor((s.endedAt-s.startedAt)/1000)):'En curso'}</td><td>{formatMoney(s.amount)}</td><td>{formatMoney(s.paidAmount)}</td><td>{s.status==='active'?<button className="button table-finish" onClick={()=>c&&onFinish(s,c)}>Finalizar</button>:<span className={`mini-status ${s.status}`}>{s.status==='completed'?'Completada':'Cancelada'}</span>}</td><td><div className="session-actions">{s.status==='completed'&&<button className="row-action" title="Editar sesión" aria-label="Editar sesión" onClick={()=>onEdit(s)}><Edit2 size={16}/></button>}<button className="row-action delete" title="Eliminar sesión" aria-label="Eliminar sesión" onClick={()=>onDelete(s,consoleName)}><Trash2 size={16}/></button></div></td></tr>})}</tbody></table>{items.length===0&&<div className="empty-activity">No hay sesiones en este filtro.</div>}</div></div>
}
function FinancePage({payments,sessions,expenses,onMarkPaid,onAddExpense}:{payments:Payment[];sessions:GameSession[];expenses:Expense[];onMarkPaid:(payment:Payment)=>void;onAddExpense:()=>void}) {
  const paid=payments.filter(p=>p.status==='paid').reduce((n,p)=>n+p.amount,0),pending=payments.filter(p=>p.status==='pending').reduce((n,p)=>n+p.amount,0),expenseTotal=expenses.reduce((sum,e)=>sum+e.amount,0)
  return <><section className="stats-grid"><Stat icon={<Wallet/>} label="Ingresos cobrados" value={formatMoney(paid)} note="Pagos confirmados" accent="green"/><Stat icon={<CreditCard/>} label="Saldos pendientes" value={formatMoney(pending)} note="Por cobrar" accent="amber"/><Stat icon={<CalendarClock/>} label="Sesiones registradas" value={String(sessions.length)} note="Historial de operaciones" accent="blue"/><Stat icon={<CircleDollarSign/>} label="Gastos registrados" value={formatMoney(expenseTotal)} note={`${expenses.length} movimientos`} accent="violet"/></section><div className="panel history-panel finance-list"><div className="panel-heading"><div><h2>Movimientos</h2><p>Pagos asociados a sesiones</p></div></div><div className="activity-list">{[...payments].sort((a,b)=>(b.paidAt??b.createdAt)-(a.paidAt??a.createdAt)).map(p=><div className="activity-row finance-row" key={p.id}><div className="activity-icon"><Wallet size={16}/></div><div className="activity-main"><b>{p.concept}</b><span>{new Date(p.status==='paid'?(p.paidAt??p.createdAt):p.createdAt).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})} · {p.method==='cash'?'Efectivo':'Transferencia'}</span></div><div className="activity-amount">{formatMoney(p.amount)}</div><span className={`mini-status ${p.status}`}>{p.status==='paid'?'Pagado':p.status==='pending'?'Pendiente':'Anulado'}</span>{p.status==='pending'&&<button className="button mark-paid" onClick={()=>onMarkPaid(p)}><Check size={15}/> Marcar cobrado</button>}</div>)}</div>{payments.length===0&&<div className="empty-activity">Los cobros aparecerán aquí al iniciar o cerrar sesiones.</div>}</div><div className="panel expense-panel"><div className="panel-heading"><div><h2>Gastos del negocio</h2><p>{expenses.length} gastos registrados · Total {formatMoney(expenseTotal)}</p></div><button className="button backup-primary" onClick={onAddExpense}><Plus size={16}/> Registrar gasto</button></div>{expenses.length>0?<div className="activity-list">{[...expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(expense=><div className="activity-row expense-row" key={expense.id}><div className="activity-icon"><CircleDollarSign size={16}/></div><div className="activity-main"><b>{expense.concept}</b><span>{expense.category} · {new Date(`${expense.date}T12:00:00`).toLocaleDateString('es-MX')} · {expense.type==='fixed'?'Fijo':'Variable'}{expense.notes?` · ${expense.notes}`:''}</span></div><div className="activity-amount expense-amount">−{formatMoney(expense.amount)}</div></div>)}</div>:<div className="empty-expenses"><span>Registra renta, servicios y otros gastos para incluirlos en la rentabilidad mensual.</span></div>}</div></>
}
