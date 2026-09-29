import { useRef, useState } from 'react'
import { HardDrive, Plus, Upload } from 'lucide-react'
import type { ProjectMediaItem } from '../../lib/studioProjectMedia'
import StudioProjectAssetPicker from './StudioProjectAssetPicker'

type Props = {
  projectId: string
  onPick: (item: ProjectMediaItem) => void
  onUploadDevice: () => void
  onUploadDrive?: () => void
  /** Chỉ nhận ảnh hoặc video — báo lỗi nếu chọn sai */
  acceptKind?: 'image' | 'video'
  compact?: boolean
}

export default function StudioProjectMediaBar({
  projectId,
  onPick,
  onUploadDevice,
  onUploadDrive,
  acceptKind,
  compact = false,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const plusRef = useRef<HTMLButtonElement>(null)

  const handlePick = (item: ProjectMediaItem) => {
    if (acceptKind && item.kind !== acceptKind) {
      window.alert(acceptKind === 'image' ? 'Chọn ảnh trong dự án' : 'Chọn video trong dự án')
      return
    }
    onPick(item)
    setPickerOpen(false)
  }

  return (
    <>
      <StudioProjectAssetPicker
        projectId={projectId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePick}
        anchorRef={plusRef}
      />
      <div className={`spmb-bar${compact ? ' compact' : ''}`}>
        <button
          ref={plusRef}
          type="button"
          className={`spmb-btn spmb-plus${pickerOpen ? ' active' : ''}`}
          title="Chọn tài liệu dự án — Tất cả / Ảnh / Video"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Chọn tài liệu dự án"
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="spmb-plus-label">+</span>
          {!compact && <span className="spmb-plus-text">Tài liệu dự án</span>}
        </button>
        <button
          type="button"
          className="spmb-btn spmb-upload"
          title="Tải lên từ máy tính"
          onClick={onUploadDevice}
        >
          <Upload size={15} />
          <span>Tải lên</span>
        </button>
        {onUploadDrive && (
          <button
            type="button"
            className="spmb-btn spmb-drive"
            title="Import Google Drive"
            onClick={onUploadDrive}
          >
            <HardDrive size={15} />
            {!compact && <span>Drive</span>}
          </button>
        )}
      </div>
    </>
  )
}
