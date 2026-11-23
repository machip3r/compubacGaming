import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export type AppDialog =
  | { kind: 'message'; title: string; message: string; resolve: () => void }
  | { kind: 'confirm'; title: string; message: string; confirmLabel: string; destructive?: boolean; resolve: (confirmed: boolean) => void }
  | { kind: 'text'; title: string; message: string; label: string; placeholder: string; submitLabel: string; resolve: (value: string | null) => void }

export function DialogView({dialog,onResolve}:{dialog:AppDialog;onResolve:(value?:boolean|string|null)=>void}) {
  const [value,setValue]=useState('')
  const dialogRef=useRef<HTMLElement>(null)
  const dismiss=()=>onResolve(dialog.kind==='confirm'?false:dialog.kind==='text'?null:undefined)
  const submit=()=>dialog.kind==='text'?onResolve(value.trim()):dialog.kind==='confirm'?onResolve(true):onResolve()
  useEffect(()=>{
    const root=dialogRef.current
    if(!root)return
    const focusable=()=>Array.from(root.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled])'))
    const initialFocus=root.querySelector<HTMLElement>('[autofocus]')
    if(initialFocus)initialFocus.focus();else focusable()[0]?.focus()
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();dismiss();return}
      if(event.key!=='Tab')return
      const items=focusable(); if(!items.length)return
      const first=items[0],last=items[items.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
    root.addEventListener('keydown',handleKeyDown)
    return ()=>root.removeEventListener('keydown',handleKeyDown)
  },[])
  return <div className="modal-backdrop app-dialog-layer" onMouseDown={e=>{if(e.target===e.currentTarget)dismiss()}}><section ref={dialogRef} className="modal app-dialog" role={dialog.kind==='text'?'dialog':'alertdialog'} aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"><div className="modal-top"><h2 id="app-dialog-title">{dialog.title}</h2><button className="icon-btn" onClick={dismiss} aria-label="Cerrar diálogo"><X size={18}/></button></div><p className="app-dialog-message" id="app-dialog-message">{dialog.message}</p>{dialog.kind==='text'&&<div className="dialog-field"><label className="field-label" htmlFor="dialog-value">{dialog.label}</label><input id="dialog-value" className="edit-input" autoFocus maxLength={180} value={value} placeholder={dialog.placeholder} onChange={e=>setValue(e.target.value)}/></div>}<div className="edit-actions dialog-actions">{dialog.kind!=='message'&&<button className="button secondary" autoFocus={dialog.kind==='confirm'} onClick={dismiss}>Volver</button>}<button className={`button ${dialog.kind==='confirm'&&dialog.destructive?'dialog-danger':'backup-primary'}`} autoFocus={dialog.kind==='message'} disabled={dialog.kind==='text'&&!value.trim()} onClick={submit}>{dialog.kind==='message'?'Entendido':dialog.kind==='confirm'?dialog.confirmLabel:dialog.submitLabel}</button></div></section></div>
}
