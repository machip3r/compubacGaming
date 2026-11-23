import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Expense } from '../../domain'

interface ExpenseDialogProps {
  onClose: () => void
  onSubmit: (input: Omit<Expense, 'id'>) => void
}

const categories: Expense['category'][] = ['Renta', 'Electricidad', 'Internet', 'Mantenimiento', 'Controles y accesorios', 'Videojuegos', 'Suscripciones', 'Limpieza', 'Otros']
const currentDate = () => {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function ExpenseDialog(props: ExpenseDialogProps) {
  const { onClose, onSubmit } = props
  const [concept, setConcept] = useState('')
  const [category, setCategory] = useState<Expense['category']>('Otros')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(currentDate)
  const [type, setType] = useState<Expense['type']>('variable')
  const [notes, setNotes] = useState('')
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal expense-modal" role="dialog" aria-modal="true" aria-labelledby="expense-title">
      <div className="modal-top"><div><span className="eyebrow">FINANZAS</span><h2 id="expense-title">Registrar gasto</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>
      <label className="field-label" htmlFor="expense-concept">Concepto</label><input id="expense-concept" className="edit-input" autoFocus maxLength={80} value={concept} placeholder="Ej. Recibo de electricidad" onChange={event => setConcept(event.target.value)}/>
      <div className="expense-fields">
        <div><label className="field-label" htmlFor="expense-category">Categoría</label><select id="expense-category" className="edit-input" value={category} onChange={event => setCategory(event.target.value as Expense['category'])}>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></div>
        <div><label className="field-label" htmlFor="expense-date">Fecha</label><input id="expense-date" className="edit-input" type="date" value={date} onChange={event => setDate(event.target.value)}/></div>
        <div><label className="field-label" htmlFor="expense-amount">Importe</label><input id="expense-amount" className="edit-input" type="number" min="0.01" step="0.01" value={amount} placeholder="0.00" onChange={event => setAmount(event.target.value)}/></div>
        <div><label className="field-label" htmlFor="expense-type">Tipo de gasto</label><select id="expense-type" className="edit-input" value={type} onChange={event => setType(event.target.value as Expense['type'])}><option value="fixed">Fijo</option><option value="variable">Variable</option></select></div>
      </div>
      <label className="field-label" htmlFor="expense-notes">Notas (opcional)</label><input id="expense-notes" className="edit-input" maxLength={180} value={notes} placeholder="Detalle adicional" onChange={event => setNotes(event.target.value)}/>
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" onClick={() => onSubmit({ concept, category, amount: Number(amount), date, type, ...(notes.trim() ? { notes: notes.trim() } : {}) })}><Check size={16}/> Guardar gasto</button></div>
    </section>
  </div>
}
