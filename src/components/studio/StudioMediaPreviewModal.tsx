import { useEffect } from 'react'
import { Download, ExternalLink, Layers, Pencil, X } from 'lucide-react'
import { downloadStudioMedia, studioDownloadFilename } from '../../lib/api'

export { downloadStudioMedia, studioDownloadFilename } from '../../lib/api'

type Props = {
  url: string
  title: string
  kind?: 'image' | 'video'
  onClose: () => void
  onOpenEditor?: () => void
  onUseAsRef?: () => void
}

export default function StudioMediaPreviewModal({
  url,
  title,
  kind = 'image',
  onClose,
  onOpenEditor,
  onUseAsRef,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sh-asset-preview-root" role="dialog" aria-modal="true" aria-label="Xem trước media">
      <button type="button" className="sh-asset-preview-backdrop" aria-label="Đóng" onClick={onClose} />
      <div className="sh-asset-preview-panel">
        <header className="sh-asset-preview-head">
          <div>
            <h3>{title}</h3>
            <p>Ảnh AI · bấm Tải về hoặc chỉnh sửa tiếp</p>
          </div>
          <button type="button" className="sh-asset-preview-close" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>
        <div className="sh-asset-preview-media">
          {kind === 'video' ? (
            <video src={url} controls autoPlay playsInline />
          ) : (
            <img src={url} alt={title} />
          )}
        </div>
        <footer className="sh-asset-preview-actions">
          <button
            type="button"
            className="sh-asset-preview-btn"
            onClick={() => {
              void downloadStudioMedia(url, studioDownloadFilename(title, kind, url)).catch((e) => {
                window.alert(e instanceof Error ? e.message : 'Không tải được file')
              })
            }}
          >
            <Download size={16} /> Tải về máy
          </button>
          {onOpenEditor && (
            <button type="button" className="sh-asset-preview-btn primary" onClick={onOpenEditor}>
              <Layers size={16} /> Mở Timeline Editor
            </button>
          )}
          {onUseAsRef && (
            <button type="button" className="sh-asset-preview-btn" onClick={onUseAsRef}>
              <Pencil size={16} /> Dùng làm ref
            </button>
          )}
          <a href={url} target="_blank" rel="noreferrer" className="sh-asset-preview-btn">
            <ExternalLink size={16} /> Mở tab mới
          </a>
        </footer>
      </div>
    </div>
  )
}
