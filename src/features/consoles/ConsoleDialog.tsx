import { useState } from 'react'
import { Gamepad2, Plus, X } from 'lucide-react'
import { consoleCatalog } from '../../domain'

interface ConsoleDialogProps {
  onClose: () => void
  onSubmit: (input: { name: string; type: string; rate: string }) => void
}

export function ConsoleDialog(props: ConsoleDialogProps) {
  const { onClose, onSubmit } = props
  const [name, setName] = useState('')
  const [type, setType] = useState('XBOX S')
  const [rate, setRate] = useState('15')
  const category = consoleCatalog.find(group => group.models.includes(type))?.category
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal add-console-modal" role="dialog" aria-modal="true" aria-labelledby="add-console-title">
      <div className="modal-top"><div><span className="eyebrow">ESTACIONES</span><h2 id="add-console-title">Agregar consola</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>
      <p className="edit-session-help">Elige la plataforma y el modelo. Puedes darle un nombre propio para identificarla.</p>
      <div className="model-preview"><div className="console-icon on"><Gamepad2 size={20}/></div><div><b>{name.trim() || type}</b><span>{category} · {type}</span></div></div>
      <label className="field-label" htmlFor="new-console-type">Tipo de consola</label>
      <select id="new-console-type" className="edit-input model-select" value={type} onChange={event => { setType(event.target.value); setRate(event.target.value === 'PS2' ? '10' : '15') }}>{consoleCatalog.map(group => <optgroup key={group.category} label={group.category}>{group.models.map(model => <option key={model} value={model}>{model}</option>)}</optgroup>)}</select>
      <label className="field-label" htmlFor="new-console-name">Nombre de estación <span className="optional-label">Opcional</span></label><input id="new-console-name" className="edit-input" maxLength={60} value={name} placeholder={`Ej. ${type} · Mostrador`} onChange={event => setName(event.target.value)}/>
      <label className="field-label console-rate-label" htmlFor="new-console-rate">Precio por hora</label><div className="money-input"><span>$</span><input id="new-console-rate" className="edit-input" type="number" min="0" step="0.01" value={rate} onChange={event => setRate(event.target.value)}/><span>MXN / hora</span></div>
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" onClick={() => onSubmit({ name, type, rate })}><Plus size={16}/> Agregar estación</button></div>
    </section>
  </div>
}
