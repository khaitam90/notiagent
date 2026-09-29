import { useEffect, useRef, useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { loadStudioAssets, type StudioAsset } from '../../lib/studioAssetLibrary'

// 2026-08-02: "Chọn từ Tệp của tôi" - tham khảo nút "Tệp của tôi" trên toolbar Comfy Cloud ("tải tài
// liệu lên workflow từ những ảnh và video đã tải lên ứng dụng notiagent"). Đọc thẳng thư viện tài
// sản đã có sẵn (lib/studioAssetLibrary.ts, lưu localStorage) - không tạo kho lưu trữ mới, chỉ thêm
// 1 nút picker cạnh nút "Tải ảnh lên" hiện có để CHỌN LẠI ảnh/video đã từng tải lên thay vì tải lại
// từ máy mỗi lần.
type Props = {
  kind: 'image' | 'video' | 'all'
  onSelect: (asset: StudioAsset) => void
}

export function WorkflowHubAssetPickerPopover({ kind, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: globalThis.MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const assets = loadStudioAssets().filter((asset) => kind === 'all' || asset.kind === kind)

  return (
    <div className="wf-asset-picker-wrap" ref={wrapRef}>
      <button
        type="button"
        className="wf-node-media-upload-btn"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
        title="Chọn ảnh/video đã có sẵn trong Tệp của tôi"
      >
        <FolderOpen size={12} />
        Tệp của tôi
      </button>
      {open && (
        <div className="wf-asset-picker-panel" onMouseDown={(event) => event.stopPropagation()}>
          {assets.length === 0 ? (
            <p className="wf-asset-picker-empty">Chưa có ảnh/video nào trong Tệp của tôi.</p>
          ) : (
            <div className="wf-asset-picker-grid">
              {assets.slice(0, 60).map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="wf-asset-picker-item"
                  onClick={() => {
                    onSelect(asset)
                    setOpen(false)
                  }}
                  title={asset.name}
                >
                  {asset.kind === 'video' ? (
                    <video src={asset.url} muted />
                  ) : (
                    <img src={asset.preview || asset.url} alt={asset.name} />
                  )}
                  <span className="wf-asset-picker-item-kind">{asset.kind === 'video' ? 'Video' : 'Ảnh'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
