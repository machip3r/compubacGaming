import { useState } from 'react'
import { Check, Clock3, X } from 'lucide-react'
import type { GameConsole, TariffPlan } from '../../domain'
import { formatMoney } from '../../domain'
import { tariffPrice } from '../../domain/pricing'

interface SetSessionLimitDialogProps {
  consoleInfo: GameConsole
  tariffs: TariffPlan[]
  onClose: () => void
  onSave: (duration: number) => void
}

const presets = [30, 60, 120, 180]

export function SetSessionLimitDialog({ consoleInfo, tariffs, onClose, onSave }: SetSessionLimitDialogProps) {
  const [duration, setDuration] = useState(60)
  const [customDuration, setCustomDuration] = useState(45)
  const isCustom = !presets.includes(duration)
  const price = tariffPrice(consoleInfo, duration, tariffs)

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="set-session-limit-title">
      <div className="modal-top"><div><span className="eyebrow">SESIÓN ACTIVA · {consoleInfo.name}</span><h2 id="set-session-limit-title">Poner límite de tiempo</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar diálogo"><X size={18}/></button></div>
      <p className="edit-session-help">La sesión pasará a tiempo prepagado. El importe quedará pendiente de pago y el contador empezará desde ahora.</p>
      <div className="field-label">Elige la duración</div>
      <div className="duration-grid">{presets.map(minutes => <button key={minutes} className={`duration-option ${duration === minutes ? 'selected' : ''}`} aria-pressed={duration === minutes} onClick={() => setDuration(minutes)}><b>{minutes < 60 ? `${minutes} min` : `${minutes / 60} ${minutes === 60 ? 'hora' : 'horas'}`}</b><span>{formatMoney(tariffPrice(consoleInfo, minutes, tariffs))}</span></button>)}
        <button className={`duration-option ${isCustom ? 'selected' : ''}`} aria-pressed={isCustom} onClick={() => setDuration(customDuration)}><b>Personalizado</b><span>Elegir tiempo</span></button>
        <label className="custom-duration"><span className="field-label">Minutos</span><input aria-label="Minutos personalizados" type="number" min="1" max="720" disabled={!isCustom} value={customDuration} onChange={event => { const minutes = Math.min(720, Math.max(1, Number(event.target.value) || 1)); setCustomDuration(minutes); setDuration(minutes) }}/></label>
      </div>
      <div className="price-preview"><div><span>Pago pendiente</span><small>{duration} minutos · tarifa por paquete</small></div><b>{formatMoney(price)}</b></div>
      <div className="helper-note"><Clock3 size={15}/> Aviso visual 5 minutos antes; la sesión no termina sola.</div>
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" onClick={() => onSave(duration)}><Check size={16}/> Aplicar límite</button></div>
    </section>
  </div>
}
