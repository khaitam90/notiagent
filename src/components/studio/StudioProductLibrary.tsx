import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Download, ExternalLink, Film, Folder, Image as ImageIcon, Layers, Trash2, Search, X,
} from 'lucide-react'
import {
  STUDIO_PRODUCTS_EVENT,
  clearStudioProducts,
  deleteStudioProduct,
  loadStudioProducts,
  loadStudioProductsForProject,
  productSourceLabel,
  type StudioProduct,
  type StudioProductKind,
} from '../../lib/studioProductLibrary'
import { findStudioProject } from '../../lib/studioProjects'
import { setStudioHandoff } from '../../lib/studioHandoff'
import { downloadStudioMedia, studioDownloadFilename, studioThumbnailUrl } from '../../lib/api'
import { scheduleStudioCloudPushAfterDelete } from '../../lib/studioSync'
import StudioStorageSettingsPanel from './StudioStorageSettingsPanel'

type AssetFolder = StudioProductKind

const ASSET_FOLDERS: { id: AssetFolder; label: string; icon: typeof Film }[] = [
  { id: 'video', label: 'Video', icon: Film },
  { id: 'image', label: 'Ảnh', icon: ImageIcon },
]

function parseFolder(raw: string | null): AssetFolder {
  return raw === 'image' ? 'image' : 'video'
}

/** Chỉ mount thumbnail khi gần viewport — tránh tải hàng loạt cùng lúc. */
function useInView<T extends HTMLElement>(rootMargin = '64px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true)
            io.unobserve(el)
            break
          }
        }
      },
      { rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return [ref, inView] as const
}

/** Video — thumbnail qua VPS ffmpeg (không tải full MP4 vào browser). */
function VideoThumb({ src, poster, alt }: { src: string; poster?: string; alt: string }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [failed, setFailed] = useState(false)
  const thumbSrc = studioThumbnailUrl(poster || src)

  return (
    <div ref={ref} className="sh-library-video-wrap">
      {!inView || failed ? (
        <div className="sh-library-video-placeholder">
          <Film size={26} strokeWidth={1.25} />
        </div>
      ) : (
        <img
          src={thumbSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

/** Ảnh — thumbnail WebP ~420px qua VPS (thay fetch 4K + canvas client-side). */
function LazyImageThumb({ src, alt }: { src: string; alt: string }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const [failed, setFailed] = useState(false)
  const thumbSrc = studioThumbnailUrl(src)

  return (
    <div ref={ref} className="sh-library-video-wrap">
      {!inView || failed ? (
        <div className="sh-library-video-placeholder">
          <ImageIcon size={26} strokeWidth={1.25} />
        </div>
      ) : (
        <img
          src={thumbSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

type Props = {
  projectId?: string
  title?: string
  subtitle?: string
  showProjectBadge?: boolean
}

export default function StudioProductLibrary({
  projectId,
  title = 'Tài sản',
  subtitle = 'Sản phẩm AI — chia 2 thư mục Video và Ảnh',
  showProjectBadge = true,
}: Props) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const loadItems = useCallback(
    () => (projectId ? loadStudioProductsForProject(projectId) : loadStudioProducts()),
    [projectId],
  )
  const [items, setItems] = useState<StudioProduct[]>(() => loadItems())
  const [folder, setFolder] = useState<AssetFolder>(() =>
    projectId ? 'video' : parseFolder(params.get('folder')),
  )
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<StudioProduct | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const counts = useMemo(() => ({
    video: items.filter((p) => p.kind === 'video').length,
    image: items.filter((p) => p.kind === 'image').length,
  }), [items])

  const setActiveFolder = useCallback((next: AssetFolder) => {
    setFolder(next)
    if (!projectId) {
      setParams((p) => {
        const q = new URLSearchParams(p)
        q.set('section', 'library')
        q.set('folder', next)
        return q
      }, { replace: true })
    }
  }, [projectId, setParams])

  useEffect(() => {
    if (projectId) return
    const fromUrl = parseFolder(params.get('folder'))
    if (fromUrl !== folder) setFolder(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get('folder'), projectId])

  const refresh = useCallback(() => setItems(loadItems()), [loadItems])

  useEffect(() => {
    refresh()
    const onUpdate = () => refresh()
    window.addEventListener(STUDIO_PRODUCTS_EVENT, onUpdate)
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(STUDIO_PRODUCTS_EVENT, onUpdate)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((p) => {
      if (p.kind !== folder) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q)
        || (p.prompt?.toLowerCase().includes(q))
        || (p.model?.toLowerCase().includes(q))
      )
    })
  }, [items, folder, query])

  const openInEditor = (p: StudioProduct) => {
    setPreview(null)
    setStudioHandoff({
      type: p.kind,
      url: p.url,
      name: p.title,
      ratio: p.ratio,
      durationSec: p.durationSec,
    })
    navigate('/studio/editor')
  }

  const removeProduct = (p: StudioProduct) => {
    if (!window.confirm(`Xóa「${p.title}」khỏi Tài sản?`)) return
    deleteStudioProduct(p.id)
    if (preview?.id === p.id) setPreview(null)
    refresh()
    scheduleStudioCloudPushAfterDelete()
  }

  const download = async (p: StudioProduct) => {
    setDownloadingId(p.id)
    try {
      await downloadStudioMedia(
        p.url,
        studioDownloadFilename(p.title, p.kind, p.url),
        { kind: p.kind },
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Không tải được file — thử Mở tab mới')
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="sh-library">
      <header className="sh-library-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {items.length > 0 && !projectId && (
          <button type="button" className="sh-library-clear" onClick={() => {
            if (confirm('Xóa toàn bộ thư viện trên trình duyệt này?')) {
              clearStudioProducts()
              refresh()
              scheduleStudioCloudPushAfterDelete()
            }
          }}>
            Xóa tất cả
          </button>
        )}
      </header>

      {!projectId && <StudioStorageSettingsPanel compact />}

      <nav className="sh-library-folders" aria-label="Thư mục Tài sản">
        {ASSET_FOLDERS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`sh-library-folder${folder === id ? ' active' : ''}`}
            onClick={() => setActiveFolder(id)}
            aria-current={folder === id ? 'page' : undefined}
          >
            <span className="sh-library-folder-icon">
              <Folder size={18} />
              <Icon size={14} className="sh-library-folder-kind" />
            </span>
            <span className="sh-library-folder-label">{label}</span>
            <span className="sh-library-folder-count">{counts[id]}</span>
          </button>
        ))}
      </nav>

      <div className="sh-library-toolbar">
        <div className="sh-library-search">
          <Search size={16} />
          <input
            type="search"
            placeholder={folder === 'video' ? 'Tìm trong thư mục Video…' : 'Tìm trong thư mục Ảnh…'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="sh-library-empty">
          {folder === 'video' ? <Film size={40} strokeWidth={1.25} /> : <ImageIcon size={40} strokeWidth={1.25} />}
          <p>{counts[folder] === 0 ? `Chưa có ${folder === 'video' ? 'video' : 'ảnh'} nào` : 'Không tìm thấy kết quả'}</p>
          <small>
            {counts[folder] === 0
              ? (projectId
                ? `Tạo ${folder === 'video' ? 'video' : 'ảnh'} ở tab Studio trong dự án — sẽ xuất hiện ở đây`
                : `Tạo ${folder === 'video' ? 'video' : 'ảnh'} ở Studio AI — tự lưu vào thư mục ${folder === 'video' ? 'Video' : 'Ảnh'}`)
              : 'Thử từ khóa khác hoặc chuyển thư mục'}
          </small>
        </div>
      ) : (
        <div className="sh-library-folder-panel">
          <header className="sh-library-folder-head">
            <Folder size={16} />
            <h3>{folder === 'video' ? 'Video' : 'Ảnh'}</h3>
            <span>{filtered.length} mục</span>
          </header>
          <div className="sh-library-grid">
          {filtered.map((p) => (
            <article key={p.id} className="sh-library-card">
              <div
                className="sh-library-thumb"
                onClick={() => setPreview(p)}
                onKeyDown={(e) => e.key === 'Enter' && setPreview(p)}
                role="button"
                tabIndex={0}
                title="Xem trước"
              >
                {p.kind === 'video' ? (
                  <VideoThumb src={p.url} poster={p.thumbnail} alt={p.title} />
                ) : (
                  <LazyImageThumb src={p.thumbnail || p.url} alt={p.title} />
                )}
                <span className={`sh-library-badge sh-library-badge-${p.kind}`}>
                  {p.kind === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
                  {p.kind === 'video' ? 'Video' : 'Ảnh'}
                </span>
              </div>
              <div className="sh-library-card-body">
                <strong title={p.title}>{p.title}</strong>
                <small>
                  {productSourceLabel(p.source)}{p.model ? ` · ${p.model}` : ''}
                  {showProjectBadge && p.projectId && (
                    <> · <span className="sh-library-project-tag">{findStudioProject(p.projectId)?.name || 'Dự án'}</span></>
                  )}
                  {!p.projectId && showProjectBadge && !projectId && (
                    <> · <span className="sh-library-project-tag global">Studio chung</span></>
                  )}
                </small>
                <small className="sh-library-date">
                  {new Date(p.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </small>
              </div>
              <div className="sh-library-card-actions">
                <button type="button" title="Mở Timeline Editor" onClick={() => openInEditor(p)}>
                  <Layers size={14} />
                </button>
                <button
                  type="button"
                  title="Tải về máy"
                  disabled={downloadingId === p.id}
                  onClick={() => { void download(p) }}
                >
                  <Download size={14} />
                </button>
                <a href={p.url} target="_blank" rel="noreferrer" title="Mở tab mới">
                  <ExternalLink size={14} />
                </a>
                <button type="button" title="Xóa" className="danger" onClick={(e) => { e.stopPropagation(); removeProduct(p) }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
          </div>
        </div>
      )}

      <p className="sh-library-foot">
        Tài sản gồm 2 thư mục: <strong>Video</strong> và <strong>Ảnh</strong>. Upload ref nằm ở tab「Đã tải lên」.
      </p>

      {preview && (
        <div className="sh-asset-preview-root" role="dialog" aria-modal="true" aria-label="Xem trước tài sản">
          <button type="button" className="sh-asset-preview-backdrop" aria-label="Đóng" onClick={() => setPreview(null)} />
          <div className="sh-asset-preview-panel">
            <header className="sh-asset-preview-head">
              <div>
                <h3>{preview.title}</h3>
                <p>{productSourceLabel(preview.source)}{preview.model ? ` · ${preview.model}` : ''}</p>
              </div>
              <button type="button" className="sh-asset-preview-close" onClick={() => setPreview(null)} aria-label="Đóng">
                <X size={20} />
              </button>
            </header>
            <div className="sh-asset-preview-media">
              {preview.kind === 'video' ? (
                <video src={preview.url} controls autoPlay playsInline />
              ) : (
                <img src={preview.url} alt={preview.title} />
              )}
            </div>
            <footer className="sh-asset-preview-actions">
              <button type="button" className="sh-asset-preview-btn danger" onClick={() => removeProduct(preview)}>
                <Trash2 size={16} /> Xóa
              </button>
              <button type="button" className="sh-asset-preview-btn" onClick={() => { void download(preview) }}>
                <Download size={16} /> Tải về máy
              </button>
              <button type="button" className="sh-asset-preview-btn primary" onClick={() => openInEditor(preview)}>
                <Layers size={16} /> Mở Timeline Editor
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
