import { Activity, CalendarClock, Check, Clock3, Gamepad2, Plus, TrendingUp, Wallet, X } from 'lucide-react'
import { elapsed, formatMoney, formatTime, openSessionAmount, type GameConsole, type GameSession, type Payment } from '../../domain'
import { Stat } from '../../shared/Stat'

interface DashboardPageProps {
  consoles: GameConsole[]
  payments: Payment[]
  activeSessions: GameSession[]
  activeByConsole: Map<string, GameSession>
  todayStart: Date
  todayIncome: number
  todayPayments: Payment[]
  completedToday: GameSession[]
  todayHours: number
  recent: GameSession[]
  now: number
  onStart: (consoleInfo: GameConsole) => void
  onFinish: (session: GameSession, consoleInfo: GameConsole) => void
  onExtend: (session: GameSession, consoleInfo: GameConsole) => void
  onCancel: (session: GameSession, consoleInfo: GameConsole) => void
  onNavigate: (page: string) => void
}

export function DashboardPage(props: DashboardPageProps) {
  const { consoles, payments, activeSessions, activeByConsole, todayStart, todayIncome, todayPayments, completedToday, todayHours, recent, now, onStart, onFinish, onExtend, onCancel, onNavigate } = props

  return <>
    <section className="stats-grid">
      <Stat icon={<Wallet/>} label="Ingresos de hoy" value={formatMoney(todayIncome)} note={`${todayPayments.length} cobros registrados`} accent="green"/>
      <Stat icon={<Gamepad2/>} label="Sesiones activas" value={String(activeSessions.length).padStart(2, '0')} note={`${consoles.filter(c => c.active && c.status === 'available').length} consolas disponibles`} accent="blue"/>
      <Stat icon={<Clock3/>} label="Horas de juego" value={`${todayHours.toFixed(1)} h`} note="Tiempo acumulado hoy" accent="violet"/>
      <Stat icon={<TrendingUp/>} label="Sesiones completadas" value={String(completedToday.length).padStart(2, '0')} note="Desde las 00:00 h" accent="amber"/>
    </section>
    <section className="section-head"><div><h2>Estaciones</h2><p>Estado en tiempo real · Actualizado automáticamente</p></div></section>
    <section className="console-grid">
      {consoles.filter(c => c.active).map(consoleInfo => {
        const session = activeByConsole.get(consoleInfo.id)
        const seconds = session ? elapsed(session.startedAt, now) : 0
        const remaining = session?.durationMinutes ? Math.max(0, session.durationMinutes * 60 - seconds) : null
        const expired = remaining !== null && remaining === 0
        const warning = remaining !== null && remaining > 0 && remaining <= 300
        const charge = session ? (session.mode === 'prepaid' ? session.amount : openSessionAmount(session.rate, session.startedAt, now, 'minute')) : 0

        return <article className={`console-card ${session ? 'is-occupied' : ''} ${warning ? 'is-warning' : ''} ${expired ? 'is-expired' : ''}`} key={consoleInfo.id}>
          <div className="card-top">
            <div className={`console-icon ${session ? 'on' : ''}`}><Gamepad2 size={20}/></div>
            <span className={`status ${session ? expired ? 'red' : warning ? 'amber' : 'blue' : 'green'}`}><i/>{session ? expired ? 'Tiempo agotado' : warning ? 'Por terminar' : 'En uso' : 'Disponible'}</span>
          </div>
          <div className="console-title"><h3>{consoleInfo.name}</h3><span>{consoleInfo.type} <b>·</b> {formatMoney(consoleInfo.hourlyRate)}/hora</span></div>
          {session ? <>
            <div className="timer-box"><div><span className="timer-label">{session.mode === 'prepaid' ? 'TIEMPO RESTANTE' : 'TIEMPO TRANSCURRIDO'}</span><strong className={expired ? 'timer-red' : ''}>{formatTime(session.mode === 'prepaid' ? remaining! : seconds)}</strong></div><div className="timer-side"><span>INICIO</span><b>{new Date(session.startedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</b></div></div>
            <div className="card-summary"><div><span>Importe</span><b>{formatMoney(charge)}</b></div><div><span>{session.mode === 'prepaid' ? 'Termina' : 'Modalidad'}</span><b>{session.mode === 'prepaid' ? new Date(session.startedAt + (session.durationMinutes ?? 0) * 60000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : 'Tiempo libre'}</b></div></div>
            <div className="card-actions"><button className="button outline" onClick={() => onExtend(session, consoleInfo)}><Plus size={15}/> +30 min</button><button className="button cancel-session icon-cancel" title="Cancelar sesión" aria-label="Cancelar sesión" onClick={() => onCancel(session, consoleInfo)}><X size={15}/></button><button className="button finish" onClick={() => onFinish(session, consoleInfo)}><Check size={15}/> Finalizar</button></div>
          </> : <>
            <div className="available-body"><div className="available-orb"><Activity size={22}/></div><p>Lista para recibir<br/>una nueva sesión</p></div>
            <button disabled={consoleInfo.status === 'service'} className="button start-button" onClick={() => onStart(consoleInfo)}><Plus size={16}/> Iniciar sesión</button>
          </>}
        </article>
      })}
    </section>
    <section className="bottom-grid">
      <div className="panel recent-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimas sesiones registradas</p></div><button className="text-button" onClick={() => onNavigate('Sesiones')}>Ver historial <span>→</span></button></div>
        {recent.length ? <div className="activity-list">{recent.map(session => { const consoleInfo = consoles.find(item => item.id === session.consoleId); return <div className="activity-row" key={session.id}><div className="activity-icon"><Gamepad2 size={16}/></div><div className="activity-main"><b>{consoleInfo?.name ?? 'Consola'}</b><span>{session.status === 'active' ? 'Sesión en curso' : session.status === 'completed' ? 'Sesión completada' : 'Sesión cancelada'} · {new Date(session.startedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span></div><div className="activity-amount">{formatMoney(session.amount)}</div><span className={`mini-status ${session.status}`}>{session.status === 'active' ? 'Activa' : session.status === 'completed' ? 'Completada' : 'Cancelada'}</span></div>})}</div> : <div className="empty-activity"><div className="empty-icon"><CalendarClock size={19}/></div><b>Tu actividad aparecerá aquí</b><span>Inicia una sesión para comenzar a registrar movimientos.</span></div>}
      </div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h2>Resumen del día</h2><p>Hoy, {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p></div><div className="summary-icon"><Wallet size={18}/></div></div><div className="summary-line"><span>Ingresos cobrados</span><b>{formatMoney(todayIncome)}</b></div><div className="summary-line"><span>Pagos pendientes</span><b>{formatMoney(payments.filter(payment => payment.status === 'pending' && payment.createdAt >= todayStart.getTime()).reduce((sum, payment) => sum + payment.amount, 0))}</b></div><div className="summary-line"><span>Tiempo de juego</span><b>{`${Math.floor(todayHours)}h ${Math.floor(todayHours % 1 * 60)}m`}</b></div><div className="summary-footer"><button className="text-button" onClick={() => onNavigate('Finanzas')}>Ver finanzas →</button></div></div>
    </section>
  </>
}
