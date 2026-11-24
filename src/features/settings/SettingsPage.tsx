import { useRef } from 'react'
import { Activity, BarChart3, Download, FileSpreadsheet, Gamepad2, Plus, ShieldCheck, Wallet } from 'lucide-react'
import { formatMoney, type GameConsole, type TariffPlan } from '../../domain'
import type { AuditFileStatus } from '../../data/auditCsv'
import { ActionCardButton } from '../../shared/ActionCardButton'

interface SettingsPageProps {
  consoles: GameConsole[]
  tariffs: TariffPlan[]
  onAddConsole: () => void
  onEditConsole: (consoleInfo: GameConsole) => void
  onRemoveConsole: (consoleInfo: GameConsole) => void
  onRestoreConsole: (consoleInfo: GameConsole) => void
  onDeleteConsole: (consoleInfo: GameConsole) => void
  onExportCsv: () => void
  onExportBackup: () => void
  onImportBackup: (file?: File) => void
  auditStatus: AuditFileStatus
  onConnectAuditCsv: () => void
  onRequestAuditPermission: () => void
  onDownloadAuditCsv: () => void
}

export function SettingsPage(props: SettingsPageProps) {
  const { consoles, tariffs, onAddConsole, onEditConsole, onRemoveConsole, onRestoreConsole, onDeleteConsole, onExportCsv, onExportBackup, onImportBackup, auditStatus, onConnectAuditCsv, onRequestAuditPermission, onDownloadAuditCsv } = props
  const backupInput = useRef<HTMLInputElement>(null)
  const orderedConsoles = [...consoles].sort((a, b) => Number(b.active) - Number(a.active) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

  return <>
    <section className="panel settings-panel">
      <div className="panel-heading"><div><h2>Tarifas por estación</h2><p>El precio se conserva en las sesiones que ya comenzaron.</p></div><button className="button backup-primary" onClick={onAddConsole}><Plus size={16}/> Agregar consola</button></div>
      {orderedConsoles.map(consoleInfo => <div className={`rate-row${consoleInfo.active ? '' : ' is-inactive'}`} key={consoleInfo.id}>
        <div className="activity-icon"><Gamepad2 size={16}/></div><div><b>{consoleInfo.name}</b><small>{consoleInfo.category ?? (consoleInfo.type === 'PS2' ? 'PlayStation' : 'XBOX')} · {consoleInfo.type}</small></div>
        <span className="rate-value">{formatMoney(consoleInfo.hourlyRate)} <small>/ hora</small></span>
        <div className="rate-actions">
          {!consoleInfo.active && <span className="mini-status inactive">Inactiva</span>}
          <button className="text-button" onClick={() => onEditConsole(consoleInfo)} aria-label={`Editar ${consoleInfo.name}`}>Editar</button>
          {consoleInfo.active
            ? <button className="text-button danger" onClick={() => onRemoveConsole(consoleInfo)} aria-label={`Desactivar ${consoleInfo.name}`}>Desactivar</button>
            : <>
              <button className="text-button" onClick={() => onRestoreConsole(consoleInfo)} aria-label={`Reactivar ${consoleInfo.name}`}>Reactivar</button>
              <button className="text-button danger" onClick={() => onDeleteConsole(consoleInfo)} aria-label={`Eliminar definitivamente ${consoleInfo.name}`}>Eliminar</button>
            </>}
        </div>
      </div>)}
      <div className="settings-note">La tarifa vigente queda guardada en cada sesión para conservar el historial.</div>
      <div className="panel-heading tariff-heading"><div><h2>Paquetes sugeridos</h2><p>Tarifas de referencia por consola.</p></div></div><div className="tariff-grid">{tariffs.map(tariff => <div className="tariff" key={tariff.id}><b>{tariff.label}</b><span>PS2 <strong>{formatMoney(tariff.ps2Price)}</strong></span><span>Xbox <strong>{formatMoney(tariff.xboxPrice)}</strong></span></div>)}</div>
    </section>
    <section className="panel backup-panel"><div className="backup-content"><div className="backup-copy-column"><div className="panel-heading"><div><h2>Registros y respaldos</h2><p>Descarga o restaura los datos del negocio.</p></div></div></div>
      <div className="backup-actions">
        <ActionCardButton icon={BarChart3} label="Descargar registros CSV" description="Sesiones, extensiones, pagos y gastos" tone="blue" onClick={onExportCsv}/>
        <ActionCardButton icon={Wallet} label="Descargar respaldo completo" description="Incluye consolas, tarifas y configuración" tone="turquoise" onClick={onExportBackup}/>
        <ActionCardButton icon={Activity} label="Restaurar desde archivo" description="Reemplaza los datos tras confirmarlo" tone="neutral" onClick={() => backupInput.current?.click()}/>
        <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={event => { void onImportBackup(event.currentTarget.files?.[0]); event.currentTarget.value = '' }}/>
      </div>
    </div></section>
    <section className="panel backup-panel audit-panel"><div className="audit-content"><div className="backup-copy-column"><div className="panel-heading"><div><h2>Registro local de acciones</h2><p>Guarda e importa automáticamente el historial CSV al abrir la aplicación cuando el permiso esté disponible.</p></div></div>
      {auditStatus.kind === 'ready' && <p role="status">Archivo vinculado: <b>{auditStatus.fileName}</b>. Se importaron {auditStatus.imported} acciones nuevas.</p>}
      {auditStatus.kind === 'unlinked' && <p>Vincula un CSV local una vez. Las acciones también se conservan en la base local de la aplicación.</p>}
      {auditStatus.kind === 'permission-required' && <p>El navegador necesita permiso para abrir <b>{auditStatus.fileName}</b> otra vez.</p>}
      {auditStatus.kind === 'unsupported' && <p>Este navegador no permite vincular archivos locales. Las acciones seguirán guardándose en la aplicación.</p>}
      {auditStatus.kind === 'error' && <p role="alert">No se pudo sincronizar el CSV: {auditStatus.message}</p>}
    </div>
    <div className="audit-actions">
      {auditStatus.kind === 'permission-required' ? <ActionCardButton icon={ShieldCheck} label="Permitir acceso al CSV" tone="turquoise" onClick={onRequestAuditPermission}/> : auditStatus.kind !== 'unsupported' && <ActionCardButton icon={FileSpreadsheet} label={auditStatus.kind === 'ready' ? 'Cambiar archivo CSV' : 'Vincular archivo CSV'} tone="blue" onClick={onConnectAuditCsv}/>}
      <ActionCardButton icon={Download} label="Descargar bitácora CSV" tone="neutral" onClick={onDownloadAuditCsv}/>
    </div>
    </div></section>
  </>
}
