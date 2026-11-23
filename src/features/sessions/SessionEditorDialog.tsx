import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { GameSession } from '../../domain'

interface SessionEditorDialogProps {
  session: GameSession
  consoles: { id: string; name: string; type: string; active: boolean }[]
  onClose: () => void
  onSave: (input: { consoleId: string; startedAt: string; endedAt: string; rate: string; amount: string }) => void
}

export function SessionEditorDialog(props: SessionEditorDialogProps) {
  const { session, consoles, onClose, onSave } = props
  const [consoleId, setConsoleId] = useState(session.consoleId)
  const [startedAt, setStartedAt] = useState(toDateTimeInput(session.startedAt))
  const [endedAt, setEndedAt] = useState(toDateTimeInput(session.endedAt ?? session.startedAt))
  const [rate, setRate] = useState(String(session.rate))
  const [amount, setAmount] = useState(String(session.amount))
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal edit-session-modal" role="dialog" aria-modal="true" aria-labelledby="edit-session-title">
      <div className="modal-top"><div><span className="eyebrow">HISTORIAL</span><h2 id="edit-session-title">Editar sesión</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>
      <p className="edit-session-help">Ajusta los datos registrados. Si cambias el importe, el saldo pendiente se recalculará y quedará asentado.</p>
      <label className="field-label" htmlFor="edit-console">Consola</label><select id="edit-console" className="edit-input" value={consoleId} onChange={event => setConsoleId(event.target.value)}>{consoles.filter(consoleInfo => consoleInfo.active || consoleInfo.id === session.consoleId).map(consoleInfo => <option key={consoleInfo.id} value={consoleInfo.id}>{consoleInfo.name} · {consoleInfo.type}{consoleInfo.active ? '' : ' · Inactiva'}</option>)}</select>
      <label className="field-label" htmlFor="edit-start">Hora de inicio</label><input id="edit-start" className="edit-input" type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)}/>
      <label className="field-label" htmlFor="edit-end">Hora de finalización</label><input id="edit-end" className="edit-input" type="datetime-local" value={endedAt} onChange={event => setEndedAt(event.target.value)}/>
      <div className="edit-numbers"><div><label className="field-label" htmlFor="edit-rate">Tarifa por hora</label><input id="edit-rate" className="edit-input" type="number" min="0" step="0.01" value={rate} onChange={event => setRate(event.target.value)}/></div><div><label className="field-label" htmlFor="edit-amount">Importe total</label><input id="edit-amount" className="edit-input" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)}/></div></div>
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Volver</button><button className="button backup-primary" onClick={() => onSave({ consoleId, startedAt, endedAt, rate, amount })}><Check size={16}/> Guardar cambios</button></div>
    </section>
  </div>
}

function toDateTimeInput(timestamp: number) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
