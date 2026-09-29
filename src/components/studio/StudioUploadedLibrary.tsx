import { STUDIO_PRODUCTS_EVENT } from '../../lib/studioProductLibrary'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download, Film, FolderOpen, HardDrive, Image as ImageIcon, Layers, Trash2, Upload, Wand2, X,
} from 'lucide-react'
import { downloadStudioMedia, importMediaUrl, studioDownloadFilename, uploadMedia } from '../../lib/api'
import {
  STUDIO_ASSETS_EVENT,
  clearStudioAssets,
  loadStudioAssets,
  registerStudioUpload,
  removeStudioAsset,
  type StudioAssetKind,
} from '../../lib/studioAssetLibrary'
import { loadProjectUploads, type ProjectMediaItem } from '../../lib/studioProjectMedia'
import { setStudioHandoff } from '../../lib/studioHandoff'
import { setStudioRefHandoff } from '../../lib/studioRefHandoff'

type Filter = 'all' | StudioAssetKind | 'image' | 'video'

const UPLOAD_FOLDERS: { id: Filter; label: string; icon: typeof FolderOpen }[] = [
  { id: 'all', label: 'Tất cả', icon: FolderOpen },
  { id: 'image', label: 'Ảnh', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Film },
]

type Props = {
  projectId?: string
  title?: string
  subtitle?: string
  showDrivePlaceholder?: boolean
}

export default function StudioUploadedLibrary({
  projectId,
  title = 'Đã tải lên',
  subtitle = 'Chỉ tài liệu bạn tải lên thủ công — ref ảnh/video, dùng @ trong prompt',
  showDrivePlaceholder = false,
}: Props) {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const loadItems = useCallback(
    () => (projectId ? loadProjectUploads(projectId) : loadStudioAssets()
      .filter((a) => a.kind === 'image' || a.kind === 'video')
      .map((a): ProjectMediaItem => ({
        id: `upload-${a.id}`,
        kind: a.kind as 'image' | 'video',
        name: a.name,
        url: a.url,
        preview: a.preview,
        createdAt: a.createdAt,
        source: 'upload',
        assetId: a.id,
      }))),
    [projectId],
  )
  const [items, setItems] = useState<ProjectMediaItem[]>(() => loadItems())
  const [filter, setFilter] = useState<Filter>('all')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<ProjectMediaItem | null>(null)

  const refresh = useCallback(() => setItems(loadItems()), [loadItems])

  useEffect(() => {
    refresh()
    const onUpdate = () => refresh()
    window.addEventListener(STUDIO_ASSETS_EVENT, onUpdate)
    return () => window.removeEventListener(STUDIO_ASSETS_EVENT, onUpdate)
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
    return items.filter((a) => {
      if (filter === 'all') return true
      return a.kind === filter
    })
  }, [items, filter])

  const counts = useMemo(() => ({
    all: items.length,
    image: items.filter((a) => a.kind === 'image').length,
    video: items.filter((a) => a.kind === 'video').length,
  }), [items])

  const openInEditor = (a: ProjectMediaItem) => {
    setStudioHandoff({
      type: a.kind,
      url: a.url,
      name: a.name,
    })
    navigate('/studio/editor')
  }

  const useInStudio = (a: ProjectMediaItem) => {
    setStudioRefHandoff({ url: a.url, kind: a.kind, name: a.name })
    if (projectId) {
      navigate(`/studio?section=projects&project=${projectId}&tab=studio&panel=create`)
    } else {
      navigate('/studio?section=studio-ai&panel=create')
    }
    setPreview(null)
  }

  const download = async (a: ProjectMediaItem) => {
    try {
      await downloadStudioMedia(
        a.url,
        studioDownloadFilename(a.name, a.kind, a.url),
        { kind: a.kind },
      )
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Không tải được file')
    }
  }

  const removeItem = (a: ProjectMediaItem) => {
    if (!a.assetId) return
    removeStudioAsset(a.assetId)
    refresh()
    setPreview(null)
  }

  const handleUpload = async (files: FileList | null) => {
    const list = files ? Array.from(files) : []
    if (!list.length) return
    setUploading(true)
    try {
      for (const f of list) {
        const kind: StudioAssetKind = f.type.startsWith('video') ? 'video' : 'image'
        const uploaded = await uploadMedia(f, kind)
        registerStudioUpload({
          kind,
          name: f.name,
          url: uploaded.url,
          preview: kind === 'image' ? uploaded.url : undefined,
          projectId: projectId ?? null,
        })
      }
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDriveImport = async () => {
    const link = window.prompt(
      'Dán link Google Drive (ảnh hoặc video, quyền「Bất kỳ ai có link」):',
    )
    if (!link?.trim()) return
    setUploading(true)
    try {
      await importMediaUrl(link.trim(), { projectId: projectId ?? null })
      refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  const activeFolder = UPLOAD_FOLDERS.find((f) => f.id === filter) ?? UPLOAD_FOLDERS[0]
  const ActiveFolderIcon = activeFolder.icon

  return (
    <div className="sh-library sh-uploads">
      <header className="sh-library-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="sh-uploads-head-actions">
          <button type="button" className="sh-uploads-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={16} />
            {uploading ? 'Đang tải…' : 'Máy tính'}
          </button>
          {showDrivePlaceholder && (
            <button
              type="button"
              className="sh-uploads-add sh-uploads-add-drive"
              disabled={uploading}
              title="Import từ link Google Drive"
              onClick={() => { void handleDriveImport() }}
            >
              <HardDrive size={16} />
              Drive
            </button>
          )}
          {items.length > 0 && !projectId && (
            <button
              type="button"
              className="sh-library-clear"
              onClick={() => {
                if (confirm('Xóa danh sách đã tải lên trên trình duyệt này? (File CDN vẫn còn)')) {
                  clearStudioAssets()
                  refresh()
                }
              }}
            >
              Xóa tất cả
            </button>
          )}
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        multiple
        hidden
        onChange={(e) => handleUpload(e.target.files)}
      />

      <nav className="sh-library-folders sh-library-folders-3" aria-label="Thư mục đã tải lên">
        {UPLOAD_FOLDERS.map(({ id, label, icon: KindIcon }) => (
          <button
            key={id}
            type="button"
            className={`sh-library-folder${filter === id ? ' active' : ''}`}
            onClick={() => setFilter(id)}
            aria-current={filter === id ? 'page' : undefined}
          >
            <span className="sh-library-folder-icon">
              <FolderOpen size={18} />
              <KindIcon size={14} className="sh-library-folder-kind" />
            </span>
            <span className="sh-library-folder-label">{label}</span>
            <span className="sh-library-folder-count">{counts[id as keyof typeof counts]}</span>
          </button>
        ))}
      </nav>

      {filtered.length === 0 ? (
        <div className="sh-library-empty">
          {filter === 'video' ? <Film size={40} strokeWidth={1.25} /> : filter === 'image' ? <ImageIcon size={40} strokeWidth={1.25} /> : <Upload size={40} strokeWidth={1.25} />}
          <p>
            {counts[filter as keyof typeof counts] === 0
              ? (filter === 'all' ? 'Chưa có tài liệu nào' : filter === 'video' ? 'Chưa có video nào' : 'Chưa có ảnh nào')
              : 'Không có mục trong thư mục này'}
          </p>
          <small>
            {counts.all === 0
              ? (projectId
                ? 'Tải từ máy tính hoặc Drive — hoặc tạo sản phẩm AI trong tab Studio'
                : 'Upload ảnh/video ref trong Tạo — hoặc bấm「Tải lên」ở trên')
              : `Thử chuyển sang thư mục ${filter === 'video' ? 'Ảnh hoặc Tất cả' : filter === 'image' ? 'Video hoặc Tất cả' : 'Ảnh hoặc Video'}`}
          </small>
          {counts.all === 0 && (
            <button type="button" className="sh-uploads-add sh-uploads-add-inline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={16} />
              {uploading ? 'Đang tải…' : 'Tải từ máy tính'}
            </button>
          )}
        </div>
      ) : (
        <div className="sh-library-folder-panel">
          <header className="sh-library-folder-head">
            <ActiveFolderIcon size={16} />
            <h3>{activeFolder.label}</h3>
            <span>{filtered.length} mục</span>
          </header>
          <div className="sh-library-grid">
          {filtered.map((a) => (
            <article key={a.id} className="sh-library-card">
              <div
                className="sh-library-thumb"
                onClick={() => setPreview(a)}
                onKeyDown={(e) => e.key === 'Enter' && setPreview(a)}
                role="button"
                tabIndex={0}
                title="Xem trước"
              >
                {a.kind === 'video' ? (
                  <video src={a.url} muted playsInline preload="metadata" />
                ) : (
                  <img src={a.preview || a.url} alt="" loading="lazy" />
                )}
                <span className={`sh-library-badge sh-library-badge-${a.kind}`}>
                  {a.kind === 'video' ? <Film size={12} /> : <ImageIcon size={12} />}
                  {a.kind === 'video' ? 'Video' : 'Ảnh'}
                </span>
              </div>
              <div className="sh-library-card-body">
                <strong title={a.name}>{a.name}</strong>
                <small className="sh-library-date">
                  {new Date(a.createdAt).toLocaleString('vi-VN', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </small>
              </div>
              <div className="sh-library-card-actions sh-library-card-actions-4">
                <button type="button" title="Mở Timeline Editor" onClick={() => openInEditor(a)}>
                  <Layers size={14} />
                  <span>Editor</span>
                </button>
                <button type="button" title="Tải xuống" onClick={() => { void download(a) }}>
                  <Download size={14} />
                  <span>Tải</span>
                </button>
                <button type="button" title="Sử dụng làm tham chiếu" onClick={() => useInStudio(a)}>
                  <Wand2 size={14} />
                  <span>Dùng</span>
                </button>
                <button type="button" title="Xóa" className="danger" onClick={() => removeItem(a)}>
                  <Trash2 size={14} />
                  <span>Xóa</span>
                </button>
              </div>
            </article>
          ))}
          </div>
        </div>
      )}

      <p className="sh-library-foot">
        {projectId
          ? 'Chỉ tài liệu tải lên thủ công trong dự án. Sản phẩm AI xem tab「Tất cả sản phẩm」.'
          : 'Chỉ file upload thủ công — không chứa sản phẩm AI. Sản phẩm render xong xem tab「Tài sản」.'}
      </p>

      {preview && (
        <div className="sh-asset-preview-root" role="dialog" aria-modal="true" aria-label="Xem trước tài liệu">
          <button type="button" className="sh-asset-preview-backdrop" aria-label="Đóng" onClick={() => setPreview(null)} />
          <div className="sh-asset-preview-panel">
            <header className="sh-asset-preview-head">
              <div>
                <h3>{preview.name}</h3>
                <p>{preview.kind === 'video' ? 'Video' : 'Ảnh'} · Đã tải lên</p>
              </div>
              <button type="button" className="sh-asset-preview-close" onClick={() => setPreview(null)} aria-label="Đóng">
                <X size={20} />
              </button>
            </header>
            <div className="sh-asset-preview-media">
              {preview.kind === 'video' ? (
                <video src={preview.url} controls autoPlay playsInline />
              ) : (
                <img src={preview.url} alt={preview.name} />
              )}
            </div>
            <footer className="sh-asset-preview-actions sh-asset-preview-actions-4">
              <button type="button" className="sh-asset-preview-btn primary" onClick={() => openInEditor(preview)}>
                <Layers size={16} /> Mở Timeline Editor
              </button>
              <button type="button" className="sh-asset-preview-btn" onClick={() => { void download(preview) }}>
                <Download size={16} /> Tải xuống
              </button>
              <button type="button" className="sh-asset-preview-btn" onClick={() => useInStudio(preview)}>
                <Wand2 size={16} /> Sử dụng
              </button>
              <button type="button" className="sh-asset-preview-btn danger" onClick={() => removeItem(preview)}>
                <Trash2 size={16} /> Xóa
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
