import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Type, X } from 'lucide-react'

// 2026-07-26i: khung soan thao toan man hinh cho noi dung dai (prompt dai, JSON dai...) - Sep yeu cau
// vi o nho tren node/inspector khong du de "nhin tong the va bao quat, biet cho nao sai can sua". Lay
// cam hung tu modal "Van ban" cua app tham khao (textarea lon + dem ky tu + nut Luu/Dong) nhung dung
// chung 1 component cho ca node inline editor (canvas) va Inspector panel, thay vi lam rieng 2 ban.
type Props = {
  title: string
  value: string
  placeholder?: string
  isEditable: boolean
  onSave: (value: string) => void
  onClose: () => void
}

export function WorkflowHubTextModal({ title, value, placeholder, isEditable, onSave, onClose }: Props) {
  const [draftValue, setDraftValue] = useState(value)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="wf-text-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="wf-text-modal">
        <div className="wf-text-modal-head">
          <span className="wf-text-modal-title-icon"><Type size={16} /></span>
          <strong>{title}</strong>
          <button type="button" className="wf-text-modal-close" onClick={onClose} title="Đóng, không lưu thay đổi">
            <X size={17} />
          </button>
        </div>
        <textarea
          className="wf-text-modal-textarea"
          autoFocus
          disabled={!isEditable}
          value={draftValue}
          placeholder={placeholder}
          onChange={(event) => setDraftValue(event.target.value)}
        />
        <div className="wf-text-modal-foot">
          <span className="wf-text-modal-count">{draftValue.length} ký tự</span>
          <button type="button" className="wf-text-modal-done" disabled={!isEditable} onClick={() => onSave(draftValue)}>
            <Check size={14} /> Xong
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
