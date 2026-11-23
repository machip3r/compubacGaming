import type { ReactNode } from 'react'

export function Stat({icon,label,value,note,accent}:{icon:ReactNode;label:string;value:string;note:string;accent:string}){return <div className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}
