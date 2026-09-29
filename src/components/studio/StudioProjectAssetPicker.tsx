import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Film, FolderOpen, Image as ImageIcon, X } from 'lucide-react'
import { STUDIO_ASSETS_EVENT } from '../../lib/studioAssetLibrary'
import { STUDIO_PRODUCTS_EVENT } from '../../lib/studioProductLibrary'
import { loadProjectMedia, type ProjectMediaItem } from '../../lib/studioProjectMedia'

type Filter = 'all' | 'image' | 'video'

const FOLDERS: { id: Filter; label: string; icon: typeof FolderOpen }[] = [
  { id: 'all', label: 'Tất cả', icon: FolderOpen },
  { id: 'image', label: 'Ảnh', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Film },
]

type Props = {
  projectId: string
  open: boolean
  onClose: () => void
  onSelect: (item: ProjectMediaItem) => void
  anchorRef?: React.RefObject<HTMLElement | null>
}

export default function StudioProjectAssetPicker({ projectId, open, onClose, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<ProjectMediaItem[]>(() => loadProjectMedia(projectId))

  const refresh = () => setItems(loadProjectMedia(projectId))

  useEffect(() => {
    if (!open) return
    refresh()
    const onUpdate = () => refresh()
    window.addEventListener(STUDIO_ASSETS_EVENT, onUpdate)
    window.addEventListener(STUDIO_PRODUCTS_EVENT, onUpdate)
    return () => {
      window.removeEventListener(STUDIO_ASSETS_EVENT, onUpdate)
      window.removeEventListener(STUDIO_PRODUCTS_EVENT, onUpdate)
    }
  }, [open, projectId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.kind === filter)
  }, [items, filter])

  const counts = useMemo(() => ({
    all: items.length,
    image: items.filter((i) => i.kind === 'image').length,
    video: items.filter((i) => i.kind === 'video').length,
  }), [items])

  if (!open) return null

  return createPortal(
    <div className="spap-root" role="dialog" aria-modal="true" aria-label="Chọn tài liệu dự án">
      <button type="button" className="spap-backdrop" aria-label="Đóng" onClick={onClose} />
      <div className="spap-sheet">
        <div className="spap-sheet-handle" aria-hidden />
        <header className="spap-head">
          <div>
            <h3>Tài liệu trong dự án</h3>
            <p>Bấm + để chọn ảnh/video làm tham chiếu — Tất cả · Ảnh · Video</p>
          </div>
          <button type="button" className="spap-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <nav className="spap-folders" aria-label="Lọc tài liệu">
          {FOLDERS.map(({ id, label, icon: KindIcon }) => (
            <button
              key={id}
              type="button"
              className={`spap-folder${filter === id ? ' active' : ''}`}
              onClick={() => setFilter(id)}
            >
              <span className="spap-folder-icon">
                <FolderOpen size={16} />
                <KindIcon size={12} />
              </span>
              <span>{label}</span>
              <em>{counts[id]}</em>
            </button>
          ))}
        </nav>

        <div className="spap-body">
          {filtered.length === 0 ? (
            <div className="spap-empty">
              <FolderOpen size={32} strokeWidth={1.25} />
              <p>{filter === 'all' ? 'Chưa có ảnh/video trong dự án' : `Chưa có ${filter === 'image' ? 'ảnh' : 'video'}`}</p>
              <small>Dùng nút「Tải lên」hoặc「Drive」bên cạnh dấu +</small>
            </div>
          ) : (
            <div className="spap-grid">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="spap-card"
                  onClick={() => { onSelect(item); onClose() }}
                  title={item.name}
                >
                  <div className="spap-thumb">
                    {item.kind === 'video' ? (
                      <video src={item.url} muted playsInline preload="metadata" />
                    ) : (
                      <img src={item.preview || item.url} alt="" loading="lazy" />
                    )}
                    <span className={`spap-badge spap-badge-${item.kind}`}>
                      {item.kind === 'video' ? 'Video' : 'Ảnh'}
                    </span>
                  </div>
                  <span className="spap-name">{item.name}</span>
                  <span className={`spap-source spap-source-${item.source}`}>
                    {item.source === 'product' ? 'Sản phẩm AI' : 'Đã tải lên'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
