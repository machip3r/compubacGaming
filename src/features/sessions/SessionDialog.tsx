import { useState } from 'react'
import { Activity, Check, Clock3, Gamepad2, X } from 'lucide-react'
import { elapsed, formatMoney, formatTime, openSessionAmount, type GameConsole, type GameSession, type PaymentMethod, type TariffPlan } from '../../domain'
import { tariffPrice } from '../../domain/pricing'

export type SessionModal = { kind: 'start'; console: GameConsole } | { kind: 'finish'; console: GameConsole; session: GameSession }

interface SessionDialogProps {
  modal: SessionModal
  now: number
  tariffs: TariffPlan[]
  method: PaymentMethod
  onClose: () => void
  onMethodChange: (method: PaymentMethod) => void
  onBegin: (input: { duration: number; mode: GameSession['mode']; paid: boolean }) => void
  onFinish: (session: GameSession, paid: boolean) => void
}

export function SessionDialog(props: SessionDialogProps) {
  const { modal, now, tariffs, method, onClose, onMethodChange, onBegin, onFinish } = props
  const [duration, setDuration] = useState(60)
  const [customDuration, setCustomDuration] = useState(45)
  const [mode, setMode] = useState<GameSession['mode']>('prepaid')
  const [paid, setPaid] = useState(true)
  const prepaidPrice = tariffPrice(modal.console, duration, tariffs)
  const total = modal.kind === 'finish' ? (modal.session.mode === 'prepaid' ? modal.session.amount : openSessionAmount(modal.session.rate, modal.session.startedAt, now)) : 0

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="session-dialog-title">
      <div className="modal-top"><div><span className="eyebrow">{modal.kind === 'start' ? 'NUEVA SESIÓN' : 'CIERRE DE SESIÓN'}</span><h2 id="session-dialog-title">{modal.kind === 'start' ? 'Iniciar sesión' : 'Finalizar sesión'}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar diálogo"><X size={18}/></button></div>
      <div className="modal-console"><div className="console-icon on"><Gamepad2 size={19}/></div><div><b>{modal.console.name}</b><span>{formatMoney(modal.console.hourlyRate)} por hora</span></div></div>
      {modal.kind === 'start' ? <>
        <div className="field-label">Modalidad</div>
        <div className="segmented"><button className={mode === 'prepaid' ? 'active' : ''} aria-pressed={mode === 'prepaid'} onClick={() => setMode('prepaid')}><Clock3 size={16}/> Tiempo prepagado</button><button className={mode === 'open' ? 'active' : ''} aria-pressed={mode === 'open'} onClick={() => setMode('open')}><Activity size={16}/> Tiempo libre</button></div>
        {mode === 'prepaid' ? <>
          <div className="field-label">Elige la duración</div>
          <div className="duration-grid">{[30, 60, 120, 180].map(minutes => <button key={minutes} className={`duration-option ${duration === minutes ? 'selected' : ''}`} onClick={() => setDuration(minutes)}><b>{minutes < 60 ? `${minutes} min` : `${minutes / 60} ${minutes === 60 ? 'hora' : 'horas'}`}</b><span>{formatMoney(tariffPrice(modal.console, minutes, tariffs))}</span></button>)}
            <button className={`duration-option ${![30, 60, 120, 180].includes(duration) ? 'selected' : ''}`} onClick={() => setDuration(customDuration)}><b>Personalizado</b><span>Elegir tiempo</span></button>
            <label className="custom-duration"><span className="field-label">Minutos</span><input aria-label="Minutos personalizados" type="number" min="1" max="720" disabled={[30, 60, 120, 180].includes(duration)} value={customDuration} onChange={event => { const minutes = Math.min(720, Math.max(1, Number(event.target.value) || 1)); setCustomDuration(minutes); setDuration(minutes) }}/></label>
          </div>
          <div className="price-preview"><div><span>Total a cobrar</span><small>{duration} minutos · tarifa por paquete</small></div><b>{formatMoney(prepaidPrice)}</b></div>
          <div className="helper-note"><Clock3 size={15}/> Aviso visual 5 minutos antes; la sesión no termina sola.</div>
          <div className="field-label">Cobro inicial</div><PaymentChoices paid={paid} method={method} onPaidChange={setPaid} onMethodChange={onMethodChange}/>
          <button className="button modal-submit" onClick={() => onBegin({ duration, mode, paid })}><Gamepad2 size={17}/> Iniciar sesión <span>·</span> {formatMoney(prepaidPrice)}</button>
        </> : <><div className="helper-note open-note"><Activity size={16}/> El cobro se calcula al finalizar, por minuto iniciado. No se registra ningún pago por adelantado.</div><div className="helper-note open-note"><Clock3 size={15}/> Aviso visual 5 minutos antes; la sesión no termina sola.</div><div className="open-rate"><span>Tarifa por hora</span><b>{formatMoney(modal.console.hourlyRate)}</b></div><button className="button modal-submit" onClick={() => onBegin({ duration, mode, paid })}><Gamepad2 size={17}/> Iniciar sesión</button></>}
      </> : <>
        <div className="finish-summary"><div><span>Duración jugada</span><b>{formatTime(elapsed(modal.session.startedAt, now))}</b></div><div><span>Importe total</span><b>{formatMoney(total)}</b></div><div><span>Ya pagado</span><b>{formatMoney(modal.session.paidAmount)}</b></div><div className="due"><span>Saldo por cobrar</span><b>{formatMoney(Math.max(0, total - modal.session.paidAmount))}</b></div></div>
        <div className="field-label">Pago restante</div><PaymentChoices paid={paid} method={method} onPaidChange={setPaid} onMethodChange={onMethodChange}/>
        <button className="button modal-submit" onClick={() => onFinish(modal.session, paid)}><Check size={16}/> Confirmar y liberar consola</button>
      </>}
    </section>
  </div>
}

function PaymentChoices({ paid, method, onPaidChange, onMethodChange }: { paid: boolean; method: PaymentMethod; onPaidChange: (paid: boolean) => void; onMethodChange: (method: PaymentMethod) => void }) {
  return <>
    <div className="pay-choice"><button className={paid ? 'chosen' : ''} aria-pressed={paid} onClick={() => onPaidChange(true)}>Cobrar ahora</button><button className={!paid ? 'chosen' : ''} aria-pressed={!paid} onClick={() => onPaidChange(false)}>Dejar pendiente</button></div>
    {paid && <div className="method-field"><div className="field-label">Método de pago</div><div className="pay-choice"><button type="button" className={method === 'cash' ? 'chosen' : ''} aria-pressed={method === 'cash'} onClick={() => onMethodChange('cash')}>Efectivo</button><button type="button" className={method === 'transfer' ? 'chosen' : ''} aria-pressed={method === 'transfer'} onClick={() => onMethodChange('transfer')}>Transferencia</button></div></div>}
  </>
}
