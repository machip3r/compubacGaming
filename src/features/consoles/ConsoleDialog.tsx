import { useState } from 'react';
import { Gamepad2, Plus, Save, X } from 'lucide-react';
import { consoleCatalog, type GameConsole } from '../../domain';

interface ConsoleDialogProps {
  consoleInfo?: GameConsole;
  onClose: () => void;
  onSubmit: (input: { name: string; type: string; rate: string; }) => void;
}

export function ConsoleDialog(props: ConsoleDialogProps) {
  const { consoleInfo, onClose, onSubmit } = props;
  const editing = Boolean(consoleInfo);
  const [name, setName] = useState(consoleInfo?.name ?? '');
  const [type, setType] = useState(consoleInfo?.type ?? 'XBOX S');
  const [rate, setRate] = useState(String(consoleInfo?.hourlyRate ?? 15));
  const originalType = consoleInfo?.type;
  const originalTypeInCatalog = !originalType || consoleCatalog.some(group => group.models.includes(originalType));
  const category = consoleCatalog.find(group => group.models.includes(type))?.category ?? consoleInfo?.category;
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal add-console-modal" role="dialog" aria-modal="true" aria-labelledby="console-dialog-title">
      <div className="modal-top"><div><span className="eyebrow">ESTACIONES</span><h2 id="console-dialog-title">{editing ? 'Editar consola' : 'Agregar consola'}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
      <p className="edit-session-help">{editing ? 'Actualiza el modelo, el nombre y el precio por hora. Las sesiones ya registradas conservan su tarifa.' : 'Elige la plataforma y el modelo. Puedes darle un nombre propio para identificarla.'}</p>
      <div className="model-preview"><div className="console-icon on"><Gamepad2 size={20} /></div><div><b>{name.trim() || type}</b><span>{category} · {type}</span></div></div>
      <label className="field-label" htmlFor="console-type">Tipo de consola</label>
      <select id="console-type" className="edit-input model-select" value={type} onChange={event => { const nextType = event.target.value; setType(nextType); if (!editing) setRate(nextType === 'PS2' ? '10' : '15'); }}>{originalType && !originalTypeInCatalog && <optgroup label="Modelo actual"><option value={originalType}>{originalType}</option></optgroup>}{consoleCatalog.map(group => <optgroup key={group.category} label={group.category}>{group.models.map(model => <option key={model} value={model}>{model}</option>)}</optgroup>)}</select>
      <label className="field-label" htmlFor="console-name">Nombre de estación <span className="optional-label">Opcional</span></label><input id="console-name" className="edit-input" maxLength={60} value={name} placeholder={`Ej. ${type} · Mostrador`} onChange={event => setName(event.target.value)} />
      <label className="field-label console-rate-label" htmlFor="console-rate">Precio por hora</label><div className="money-input"><span>$</span><input id="console-rate" className="edit-input" type="number" min="0" step="0.01" value={rate} onChange={event => setRate(event.target.value)} /></div>
      <div className="edit-actions"><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button backup-primary" onClick={() => onSubmit({ name, type, rate })}>{editing ? <><Save size={16} /> Guardar cambios</> : <><Plus size={16} /> Agregar estación</>}</button></div>
    </section>
  </div>;
}
