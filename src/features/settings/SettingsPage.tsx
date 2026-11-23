import { useRef } from 'react'
import { Activity, BarChart3, Gamepad2, Plus, Wallet, X } from 'lucide-react'
import { formatMoney, type GameConsole, type TariffPlan } from '../../domain'
import type { AuditFileStatus } from '../../data/auditCsv'

interface SettingsPageProps {
  consoles: GameConsole[]
  tariffs: TariffPlan[]
  editingRate: string | null
  rateDraft: string
  onAddConsole: () => void
  onRateDraftChange: (value: string) => void
  onSaveRate: (consoleInfo: GameConsole) => void
  onEditRate: (consoleInfo: GameConsole) => void
  onCancelRateEdit: () => void
  onExportCsv: () => void
  onExportBackup: () => void
  onImportBackup: (file?: File) => void
  auditStatus: AuditFileStatus
  onConnectAuditCsv: () => void
  onRequestAuditPermission: () => void
  onDownloadAuditCsv: () => void
}

export function SettingsPage(props: SettingsPageProps) {
  const { consoles, tariffs, editingRate, rateDraft, onAddConsole, onRateDraftChange, onSaveRate, onEditRate, onCancelRateEdit, onExportCsv, onExportBackup, onImportBackup, auditStatus, onConnectAuditCsv, onRequestAuditPermission, onDownloadAuditCsv } = props
  const backupInput = useRef<HTMLInputElement>(null)

  return <>
    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>Tarifas por estación</h2><p>El precio se conserva en las sesiones que ya comenzaron.</p></div><button className="button backup-primary" onClick={onAddConsole}><Plus size={16}/> Agregar consola</button></div>
      {consoles.map(consoleInfo => <div className="rate-row" key={consoleInfo.id}>
        <div className="activity-icon"><Gamepad2 size={16}/></div><div><b>{consoleInfo.name}</b><small>{consoleInfo.category ?? (consoleInfo.type === 'PS2' ? 'PlayStation' : 'XBOX')} · {consoleInfo.type}</small></div>
        {editingRate === consoleInfo.id ? <div className="rate-editor"><span>$</span><input aria-label={`Tarifa por hora de ${consoleInfo.name}`} autoFocus value={rateDraft} onChange={event => onRateDraftChange(event.target.value)} type="number" min="0"/><span>MXN / hora</span><button className="save-rate" onClick={() => onSaveRate(consoleInfo)}>Guardar</button><button className="cancel-rate" onClick={onCancelRateEdit} aria-label="Cancelar edición"><X size={15}/></button></div> : <><span className="rate-value">{formatMoney(consoleInfo.hourlyRate)} <small>/ hora</small></span><button className="text-button" onClick={() => onEditRate(consoleInfo)}>Editar tarifa</button></>}
      </div>)}
      <div className="settings-note">La tarifa vigente queda guardada en cada sesión para conservar el historial.</div>
      <div className="panel-heading tariff-heading"><div><h2>Paquetes sugeridos</h2><p>Tarifas de referencia por consola.</p></div></div><div className="tariff-grid">{tariffs.map(tariff => <div className="tariff" key={tariff.id}><b>{tariff.label}</b><span>PS2 <strong>{formatMoney(tariff.ps2Price)}</strong></span><span>Xbox <strong>{formatMoney(tariff.xboxPrice)}</strong></span></div>)}</div>
    </section>
    <section className="panel backup-panel"><div className="backup-content"><div className="backup-copy-column"><div className="panel-heading"><div><h2>Registros y respaldos</h2><p>Descarga o restaura los datos del negocio.</p></div></div></div>
      <div className="backup-actions">
        <button className="button backup-action-csv" onClick={onExportCsv}><BarChart3 size={18}/><span><b>Descargar registros CSV</b><small>Sesiones, extensiones, pagos y gastos</small></span></button>
        <button className="button backup-action-json" onClick={onExportBackup}><Wallet size={18}/><span><b>Descargar respaldo completo</b><small>Incluye consolas, tarifas y configuración</small></span></button>
        <button className="button backup-action-restore" onClick={() => backupInput.current?.click()}><Activity size={18}/><span><b>Restaurar desde archivo</b><small>Reemplaza los datos tras confirmarlo</small></span></button>
        <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={event => { void onImportBackup(event.currentTarget.files?.[0]); event.currentTarget.value = '' }}/>
      </div>
    </div></section>
    <section className="panel backup-panel audit-panel"><div className="panel-heading"><div><h2>Registro local de acciones</h2><p>Guarda e importa automáticamente el historial CSV al abrir la aplicación cuando el permiso esté disponible.</p></div></div>
      {auditStatus.kind === 'ready' && <p role="status">Archivo vinculado: <b>{auditStatus.fileName}</b>. Se importaron {auditStatus.imported} acciones nuevas.</p>}
      {auditStatus.kind === 'unlinked' && <p>Vincula un CSV local una vez. Las acciones también se conservan en la base local de la aplicación.</p>}
      {auditStatus.kind === 'permission-required' && <p>El navegador necesita permiso para abrir <b>{auditStatus.fileName}</b> otra vez.</p>}
      {auditStatus.kind === 'unsupported' && <p>Este navegador no permite vincular archivos locales. Las acciones seguirán guardándose en la aplicación.</p>}
      {auditStatus.kind === 'error' && <p role="alert">No se pudo sincronizar el CSV: {auditStatus.message}</p>}
      {auditStatus.kind === 'permission-required' ? <button className="button backup-primary" onClick={onRequestAuditPermission}>Permitir acceso al CSV</button> : auditStatus.kind !== 'unsupported' && <button className="button backup-primary" onClick={onConnectAuditCsv}>{auditStatus.kind === 'ready' ? 'Cambiar archivo CSV' : 'Vincular archivo CSV'}</button>}
      <button className="button secondary" onClick={onDownloadAuditCsv}>Descargar bitácora CSV</button>
    </section>
  </>
}
