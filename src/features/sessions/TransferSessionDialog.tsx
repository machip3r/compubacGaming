import { useState } from 'react'
import { ArrowRightLeft, X } from 'lucide-react'
import type { GameConsole, GameSession } from '../../domain'
import { formatTime } from '../../domain'

interface TransferSessionDialogProps {
  session: GameSession
  source: GameConsole
  consoles: GameConsole[]
  now: number
  onClose: () => void
  onTransfer: (destinationConsoleId: string) => void
}

export function TransferSessionDialog({ session, source, consoles, now, onClose, onTransfer }: TransferSessionDialogProps) {
  const choices = consoles.filter(consoleInfo => consoleInfo.id !== source.id && consoleInfo.active && consoleInfo.status === 'available' && (consoleInfo.category === 'XBOX' || /xbox/i.test(consoleInfo.type)))
  const [destinationConsoleId, setDestinationConsoleId] = useState(choices[0]?.id ?? '')
  const timerStartedAt = session.transferStartedAt ?? session.startedAt
  const remainingSeconds = Math.max(0, Math.floor((timerStartedAt + (session.durationMinutes ?? 0) * 60_000 - now) / 1000))

  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal transfer-session-modal" role="dialog" aria-modal="true" aria-labelledby="transfer-session-title">
      <div className="modal-top"><div><span className="eyebrow">SESIÓN ACTIVA</span><h2 id="transfer-session-title">Transferir tiempo</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar diálogo"><X size={18}/></button></div>
      <p className="edit-session-help">Se moverá el tiempo restante a otra Xbox. No se agrega ningún cobro ni se modifica el importe registrado.</p>
      <div className="transfer-route"><div><small>DE</small><b>{source.name}</b></div><ArrowRightLeft size={18}/><div><small>TIEMPO RESTANTE</small><b>{formatTime(remainingSeconds)}</b></div></div>
      <label className="field-label" htmlFor="transfer-destination">Consola de destino</label>
      {choices.length ? <select id="transfer-destination" className="edit-input" value={destinationConsoleId} onChange={event => setDestinationConsoleId(event.target.value)}>{choices.map(consoleInfo => <option key={consoleInfo.id} value={consoleInfo.id}>{consoleInfo.name} · {consoleInfo.type}</option>)}</select> : <p className="transfer-empty">No hay otra Xbox disponible en este momento.</p>}
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" disabled={!choices.length || !destinationConsoleId || remainingSeconds <= 0} onClick={() => onTransfer(destinationConsoleId)}><ArrowRightLeft size={16}/> Transferir sesión</button></div>
    </section>
  </div>
}
