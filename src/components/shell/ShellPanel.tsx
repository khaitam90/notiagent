import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}

export function ShellPanel({ isOpen, onClose, title, subtitle, children }: Props) {
  if (!isOpen) return null

  return (
    <>
      <button type="button" className="agent-cap-backdrop" aria-label="Đóng" onClick={onClose} />
      <aside className="agent-cap-panel shell-panel" aria-label={title}>
        <header className="agent-cap-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="agent-cap-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="agent-cap-body">{children}</div>
      </aside>
    </>
  )
}
