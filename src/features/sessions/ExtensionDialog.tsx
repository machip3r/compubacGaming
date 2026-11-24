import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { GameConsole, TariffPlan } from '../../domain'
import { formatMoney } from '../../domain'
import { tariffPrice } from '../../domain/pricing'

interface ExtensionDialogProps {
  consoleInfo: GameConsole
  tariffs: TariffPlan[]
  initialMinutes: number
  onClose: () => void
  onSave: (minutes: number, additionalCharge: number) => void
}

export function ExtensionDialog({ consoleInfo, tariffs, initialMinutes, onClose, onSave }: ExtensionDialogProps) {
  const [minutesText, setMinutesText] = useState(String(initialMinutes))
  const [hasAdditionalCharge, setHasAdditionalCharge] = useState(false)
  const [additionalChargeText, setAdditionalChargeText] = useState('')
  const [chargeAmountEdited, setChargeAmountEdited] = useState(false)
  const minutes = Number(minutesText)
  const minutesValid = Number.isInteger(minutes) && minutes >= 1 && minutes <= 720
  const additionalCharge = Number(additionalChargeText)
  const additionalChargeValid = !hasAdditionalCharge || (additionalChargeText.trim() !== '' && Number.isFinite(additionalCharge) && additionalCharge > 0)
  const suggestedCharge = minutesValid ? tariffPrice(consoleInfo, minutes, tariffs) : 0
  const setMinutes = (value: string) => {
    setMinutesText(value)
    if (hasAdditionalCharge && !chargeAmountEdited) {
      const next = Number(value)
      const valid = Number.isInteger(next) && next >= 1 && next <= 720
      setAdditionalChargeText(valid ? tariffPrice(consoleInfo, next, tariffs).toFixed(2) : '')
    }
  }

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal extension-modal" role="dialog" aria-modal="true" aria-labelledby="extension-title">
      <div className="modal-top"><div><span className="eyebrow">EXTENSIÓN DE SESIÓN</span><h2 id="extension-title">Agregar tiempo</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar diálogo"><X size={18}/></button></div>
      <p className="edit-session-help">{consoleInfo.name} · El tiempo agregado se calcula con su tarifa actual.</p>
      <label className="field-label" htmlFor="extension-minutes">Minutos</label>
      <div className="extension-minutes"><input id="extension-minutes" className="edit-input" type="number" min="1" max="720" step="1" value={minutesText} onChange={event => setMinutes(event.target.value)}/><span>min</span></div>
      {!minutesValid && <p className="extension-error" role="alert">Indica de 1 a 720 minutos, en números enteros.</p>}
      <label className="extension-charge-toggle"><input type="checkbox" checked={hasAdditionalCharge} onChange={event => { const checked = event.target.checked; setHasAdditionalCharge(checked); setChargeAmountEdited(false); setAdditionalChargeText(checked && minutesValid ? suggestedCharge.toFixed(2) : '') }}/><span>Cobrar el tiempo agregado</span></label>
      {hasAdditionalCharge && <div className="extension-extra-field"><label className="field-label" htmlFor="extension-additional-charge">Importe a cobrar</label><div className="money-input"><span>$</span><input id="extension-additional-charge" className="edit-input" type="number" min="0.01" step="0.01" value={additionalChargeText} placeholder="0.00" onChange={event => { setAdditionalChargeText(event.target.value); setChargeAmountEdited(true) }}/><span>MXN</span></div><p className="extension-recommendation">Sugerido: {formatMoney(suggestedCharge)}. Se calcula con el paquete aplicable o la tarifa por hora; puedes ajustarlo.</p>{!additionalChargeValid && <p className="extension-error" role="alert">Escribe un importe mayor que cero.</p>}<div className="extension-total"><strong>Total a cobrar</strong><strong>{formatMoney(additionalChargeValid ? additionalCharge : 0)}</strong></div></div>}
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" disabled={!minutesValid || !additionalChargeValid} onClick={() => onSave(minutes, hasAdditionalCharge ? additionalCharge : 0)}><Check size={16}/> Guardar extensión</button></div>
    </section>
  </div>
}
