import { useState } from 'react';
import { Activity, ArrowRightLeft, CalendarClock, Check, Clock3, Gamepad2, Plus, TrendingUp, Wallet, X } from 'lucide-react';
import { elapsed, formatMoney, formatTime, openSessionAmount, type GameConsole, type GameSession, type Payment, type TariffPlan } from '../../domain';
import { Stat } from '../../shared/Stat';
import { SetSessionLimitDialog } from '../sessions/SetSessionLimitDialog';

interface DashboardPageProps {
  consoles: GameConsole[];
  payments: Payment[];
  activeSessions: GameSession[];
  activeByConsole: Map<string, GameSession>;
  todayStart: Date;
  todayIncome: number;
  todayPayments: Payment[];
  completedToday: GameSession[];
  todayHours: number;
  recent: GameSession[];
  now: number;
  tariffs: TariffPlan[];
  onStart: (consoleInfo: GameConsole) => void;
  onFinish: (session: GameSession, consoleInfo: GameConsole) => void;
  onExtend: (session: GameSession, consoleInfo: GameConsole) => void;
  onCustomExtend: (session: GameSession, consoleInfo: GameConsole) => void;
  onCancel: (session: GameSession, consoleInfo: GameConsole) => void;
  onReorder: (fromId: string, toId: string) => void;
  onTransfer: (session: GameSession) => void;
  onSetLimit: (session: GameSession, duration: number) => void;
  onNavigate: (page: string) => void;
}

export function DashboardPage(props: DashboardPageProps) {
  const { consoles, payments, activeSessions, activeByConsole, todayStart, todayIncome, todayPayments, completedToday, todayHours, recent, now, tariffs, onStart, onFinish, onExtend, onCustomExtend, onCancel, onReorder, onTransfer, onSetLimit, onNavigate } = props;
  const [draggingId, setDraggingId] = useState('');
  const [dropTargetId, setDropTargetId] = useState('');
  const [orderAnnouncement, setOrderAnnouncement] = useState('');
  const [limitTarget, setLimitTarget] = useState<{ session: GameSession; consoleInfo: GameConsole } | null>(null);
  const orderedConsoles = consoles.filter(consoleInfo => consoleInfo.active).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const moveByKeyboard = (id: string, delta: number) => {
    const index = orderedConsoles.findIndex(consoleInfo => consoleInfo.id === id);
    const target = orderedConsoles[index + delta];
    if (!target) return;
    onReorder(id, target.id);
    setOrderAnnouncement(`${orderedConsoles[index].name} cambió de posición.`);
  };

  return <>
    <section className="stats-grid">
      <Stat icon={<Wallet />} label="Ingresos de hoy" value={formatMoney(todayIncome)} note={`${todayPayments.length} cobros registrados`} accent="green" />
      <Stat icon={<Gamepad2 />} label="Sesiones activas" value={String(activeSessions.length).padStart(2, '0')} note={`${consoles.filter(c => c.active && c.status === 'available').length} consolas disponibles`} accent="blue" />
      <Stat icon={<Clock3 />} label="Horas de juego" value={`${todayHours.toFixed(1)} h`} note="Tiempo acumulado hoy" accent="violet" />
      <Stat icon={<TrendingUp />} label="Sesiones completadas" value={String(completedToday.length).padStart(2, '0')} note="Desde las 00:00 h" accent="amber" />
    </section>
    <section className="section-head"><div><h2>Estaciones</h2><p>Arrastra las estaciones para cambiar su orden · Estado en tiempo real</p></div></section>
    <section className="console-grid" aria-label="Estaciones. Arrastra una estación para cambiar el orden o selecciónala y usa las flechas arriba y abajo.">
      <span className="sr-only" aria-live="polite">{orderAnnouncement}</span>
      {orderedConsoles.map((consoleInfo, consoleIndex) => {
        const session = activeByConsole.get(consoleInfo.id);
        const timerStartedAt = session ? session.transferStartedAt ?? session.startedAt : now;
        const seconds = session ? elapsed(timerStartedAt, now) : 0;
        const remaining = session?.mode === 'prepaid' && session.durationMinutes !== undefined ? Math.max(0, session.durationMinutes * 60 - seconds) : null;
        const expired = remaining !== null && remaining === 0;
        const warning = remaining !== null && remaining > 0 && remaining <= 300;
        const charge = session ? (session.mode === 'prepaid' ? session.amount : openSessionAmount(session.rate, session.startedAt, now, 'minute')) : 0;
        const canTransfer = Boolean(session && session.mode === 'prepaid' && remaining !== null && remaining > 0 && (consoleInfo.category === 'XBOX' || /xbox/i.test(consoleInfo.type)));

        return <article className={`console-card ${session ? 'is-occupied' : ''} ${warning ? 'is-warning' : ''} ${expired ? 'is-expired' : ''} ${draggingId === consoleInfo.id ? 'is-dragging' : ''} ${dropTargetId === consoleInfo.id ? 'is-drop-target' : ''}`} key={consoleInfo.id} draggable
          role="group" tabIndex={0} aria-label={`${consoleInfo.name}, estación ${consoleIndex + 1} de ${orderedConsoles.length}. Usa las flechas arriba y abajo para cambiar el orden.`}
          onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); moveByKeyboard(consoleInfo.id, event.key === 'ArrowUp' ? -1 : 1); } }}
          onDragStart={event => { if ((event.target as HTMLElement).closest('button')) { event.preventDefault(); return; } setDraggingId(consoleInfo.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', consoleInfo.id); }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetId(consoleInfo.id); }}
          onDrop={event => { event.preventDefault(); const fromId = event.dataTransfer.getData('text/plain') || draggingId; if (fromId && fromId !== consoleInfo.id) onReorder(fromId, consoleInfo.id); setDraggingId(''); setDropTargetId(''); }}
          onDragEnd={() => { setDraggingId(''); setDropTargetId(''); }}>
          <div className="card-top">
            <div className={`console-icon ${session ? 'on' : ''}`}><Gamepad2 size={20} /></div>
            <div className="station-card-controls"><span className={`status ${session ? expired ? 'red' : warning ? 'amber' : 'blue' : 'green'}`}><i />{session ? expired ? 'Tiempo agotado' : warning ? 'Por terminar' : 'En uso' : 'Disponible'}</span>{session && <>{canTransfer && <button className="station-session-action transfer" title="Transferir tiempo a otra Xbox" aria-label="Transferir tiempo a otra Xbox" onClick={() => onTransfer(session)}><ArrowRightLeft size={16} /></button>}<button className="station-session-action cancel" title="Cancelar sesión" aria-label={`Cancelar sesión en ${consoleInfo.name}`} onClick={() => onCancel(session, consoleInfo)}><X size={17} /></button></>}</div>
          </div>
          <div className="console-title"><h3>{consoleInfo.name}</h3><span>{consoleInfo.type} <b>·</b> {formatMoney(consoleInfo.hourlyRate)}/hora</span></div>
          {session ? <>
            <div className="timer-box"><div><span className="timer-label">{remaining !== null ? 'TIEMPO RESTANTE' : 'TIEMPO TRANSCURRIDO'}</span><strong className={expired ? 'timer-red' : ''}>{formatTime(remaining !== null ? remaining : seconds)}</strong></div><div className="timer-side"><span>INICIO</span><b>{new Date(session.startedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</b></div></div>
            <div className="card-summary"><div><span>Importe</span><b>{formatMoney(charge)}</b></div><div><span>{remaining !== null ? 'Termina' : 'Modalidad'}</span><b>{remaining !== null ? new Date(timerStartedAt + (session.durationMinutes ?? 0) * 60000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : 'Tiempo libre'}</b></div></div>
            <div className="card-actions">{session.mode === 'open' && <button className="button outline" onClick={() => setLimitTarget({ session, consoleInfo })}><Clock3 size={15} /> Poner límite</button>}<button className="button custom-extend-button" title="Agregar tiempo personalizado" aria-label={`Agregar tiempo personalizado a ${consoleInfo.name}`} onClick={() => onCustomExtend(session, consoleInfo)}><Plus size={18} /></button><button className="button outline" onClick={() => onExtend(session, consoleInfo)}><Plus size={15} /> 30 min</button><button className="button finish" onClick={() => onFinish(session, consoleInfo)}><Check size={15} /> Finalizar</button></div>
          </> : <>
            <div className="available-body"><div className="available-orb"><Activity size={22} /></div><p>Lista para recibir<br />una nueva sesión</p></div>
            <button disabled={consoleInfo.status === 'service'} className="button start-button" onClick={() => onStart(consoleInfo)}><Plus size={16} /> Iniciar sesión</button>
          </>}
        </article>;
      })}
    </section>
    <section className="bottom-grid">
      <div className="panel recent-panel"><div className="panel-heading"><div><h2>Actividad reciente</h2><p>Últimas sesiones registradas</p></div><button className="text-button" onClick={() => onNavigate('Sesiones')}>Ver historial <span>→</span></button></div>
        {recent.length ? <div className="activity-list">{recent.map(session => { const consoleInfo = consoles.find(item => item.id === session.consoleId); return <div className="activity-row" key={session.id}><div className="activity-icon"><Gamepad2 size={16} /></div><div className="activity-main"><b>{consoleInfo?.name ?? 'Consola'}</b><span>{session.status === 'active' ? 'Sesión en curso' : session.status === 'completed' ? 'Sesión completada' : 'Sesión cancelada'} · {new Date(session.startedAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span></div><div className="activity-amount">{formatMoney(session.amount)}</div><span className={`mini-status ${session.status}`}>{session.status === 'active' ? 'Activa' : session.status === 'completed' ? 'Completada' : 'Cancelada'}</span></div>; })}</div> : <div className="empty-activity"><div className="empty-icon"><CalendarClock size={19} /></div><b>Tu actividad aparecerá aquí</b><span>Inicia una sesión para comenzar a registrar movimientos.</span></div>}
      </div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h2>Resumen del día</h2><p>Hoy, {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}</p></div><div className="summary-icon"><Wallet size={18} /></div></div><div className="summary-line"><span>Ingresos cobrados</span><b>{formatMoney(todayIncome)}</b></div><div className="summary-line"><span>Pagos pendientes</span><b>{formatMoney(payments.filter(payment => payment.status === 'pending' && payment.createdAt >= todayStart.getTime()).reduce((sum, payment) => sum + payment.amount, 0))}</b></div><div className="summary-line"><span>Tiempo de juego</span><b>{`${Math.floor(todayHours)}h ${Math.floor(todayHours % 1 * 60)}m`}</b></div><div className="summary-footer"><button className="text-button" onClick={() => onNavigate('Finanzas')}>Ver finanzas →</button></div></div>
    </section>
    {limitTarget && <SetSessionLimitDialog consoleInfo={limitTarget.consoleInfo} tariffs={tariffs} onClose={() => setLimitTarget(null)} onSave={duration => { onSetLimit(limitTarget.session, duration); setLimitTarget(null) }} />}
  </>;
}
