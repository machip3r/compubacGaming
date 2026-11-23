import type { LucideIcon } from 'lucide-react'

export type ActionCardTone = 'blue' | 'turquoise' | 'neutral'

interface ActionCardButtonProps {
  icon: LucideIcon
  label: string
  description?: string
  tone?: ActionCardTone
  onClick: () => void
}

const toneClass: Record<ActionCardTone, string> = {
  blue: 'action-card-blue',
  turquoise: 'action-card-turquoise',
  neutral: 'action-card-neutral',
}

export function ActionCardButton({ icon: Icon, label, description, tone = 'neutral', onClick }: ActionCardButtonProps) {
  return <button type="button" className={`button action-card ${toneClass[tone]}`} onClick={onClick}>
    <Icon size={18}/>
    <span><b>{label}</b>{description && <small>{description}</small>}</span>
  </button>
}
