import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Film, Image as ImageIcon, Loader2, Sparkles, Wand2 } from 'lucide-react'
import type { AiPanel } from '../../lib/studioSections'
import { VIDEO_TOOLS } from '../../lib/videoTools'
import { IMAGE_TOOL_PRESETS } from '../../lib/imageToolPresets'
import { isImagePresetLive, isVideoToolLive } from '../../lib/studioToolsAvailability'
import {
  STUDIO_PRODUCTS_EVENT,
  loadStudioProducts,
  loadStudioProductsForProject,
  productSourceLabel,
  type StudioProduct,
} from '../../lib/studioProductLibrary'
import { STUDIO_ASSETS_EVENT, loadStudioAssets } from '../../lib/studioAssetLibrary'
import { loadProjectUploads } from '../../lib/studioProjectMedia'
import { studioThumbnailUrl } from '../../lib/api'
import { isFalseStaleErrorPreview } from '../../lib/projectWorkspaceDraft'
import StudioUploadedLibrary from './StudioUploadedLibrary'
import { STUDIO_PRO_FLOWS } from './StudioProLanding'
import SocialPublishBar from '../SocialPublishBar'

type PreviewState = {
  taskId?: string
  message?: string
  status?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
}

type Props = {
  panel: AiPanel
  projectId?: string | null
  preview: PreviewState | null
  previewImages: string[]
  isReady: boolean
  effectiveMode: 'image' | 'video'
  toolId?: string
  savedToLibrary: number | null
  onDownloadPreview: () => void
  onOpenEditor: () => void
  onPickVideoTool: (id: string) => void
  onPickImagePreset: (id: string) => void
  onStartProFlow: (flow: 'character' | 'script' | 'short-film') => void
  onGoLibrary: () => void
}

type FeedTab = 'all' | 'products' | 'uploads'

function SampleCard({
  icon, title, desc, tag, onClick,
}: { icon: string; title: string; desc: string; tag: string; onClick: () => void }) {
  return (
    <button type="button" className="sfg-sample" onClick={onClick}>
      <div className="sfg-sample-thumb">{icon}</div>
      <div className="sfg-sample-body">
        <strong>{title}</strong>
        <p>{desc}</p>
        <span className="sfg-sample-tag">{tag}</span>
      </div>
    </button>
  )
}

function ProductThumb({ item }: { item: StudioProduct }) {
  const thumb = item.kind === 'image'
    ? item.url
    : studioThumbnailUrl(item.url)
  return (
    <div className="sfg-thumb">
      {item.kind === 'video' ? (
        <img src={thumb} alt={item.title} loading="lazy" />
      ) : (
        <img src={item.url} alt={item.title} loading="lazy" />
      )}
      <span className="sfg-thumb-kind">{item.kind === 'video' ? 'Video' : 'Ảnh'}</span>
    </div>
  )
}

export default function StudioFeedPanel({
  panel,
  projectId,
  preview,
  previewImages,
  isReady,
  effectiveMode,
  toolId,
  savedToLibrary,
  onDownloadPreview,
  onOpenEditor,
  onPickVideoTool,
  onPickImagePreset,
  onStartProFlow,
  onGoLibrary,
}: Props) {
  const [feedTab, setFeedTab] = useState<FeedTab>('all')

  const loadProducts = useCallback(
    () => (projectId ? loadStudioProductsForProject(projectId) : loadStudioProducts()),
    [projectId],
  )
  const [products, setProducts] = useState<StudioProduct[]>(() => loadProducts())

  useEffect(() => {
    const refresh = () => setProducts(loadProducts())
    refresh()
    window.addEventListener(STUDIO_PRODUCTS_EVENT, refresh)
    window.addEventListener(STUDIO_ASSETS_EVENT, refresh)
    return () => {
      window.removeEventListener(STUDIO_PRODUCTS_EVENT, refresh)
      window.removeEventListener(STUDIO_ASSETS_EVENT, refresh)
    }
  }, [loadProducts])

  const uploads = useMemo(() => {
    if (projectId) return loadProjectUploads(projectId)
    return loadStudioAssets()
      .filter((a) => a.kind === 'image' || a.kind === 'video')
      .map((a) => ({
        id: a.id,
        kind: a.kind as 'image' | 'video',
        name: a.name,
        url: a.url,
        preview: a.preview,
      }))
  }, [projectId, products])

  const samples = useMemo(() => {
    const video = VIDEO_TOOLS.filter((t) => isVideoToolLive(t.id)).map((t) => ({
      id: `v-${t.id}`,
      icon: t.icon,
      title: t.label,
      desc: t.prompt.slice(0, 72) + (t.prompt.length > 72 ? '…' : ''),
      tag: `${t.ratio} · ${t.duration}s`,
      onClick: () => onPickVideoTool(t.id),
    }))
    const image = IMAGE_TOOL_PRESETS.filter((p) => isImagePresetLive(p.id)).map((p) => ({
      id: `i-${p.id}`,
      icon: p.icon,
      title: p.label,
      desc: p.desc,
      tag: 'Ảnh AI',
      onClick: () => onPickImagePreset(p.id),
    }))
    return [...video, ...image]
  }, [onPickVideoTool, onPickImagePreset])

  const renderPreviewCard = () => {
    if (!preview) return null
    const healedPreview = isFalseStaleErrorPreview(preview)
      ? {
          ...preview,
          status: 'pending',
          message: 'Đang render — đang kiểm tra lại tiến độ…',
        }
      : preview
    const hasMedia = !!(healedPreview.videoUrl || healedPreview.imageUrl || previewImages.length)
    return (
      <div className={`sfg-preview-card${hasMedia ? ' has-media' : ''}`}>
        <div className="sfg-preview-head">
          <strong>{healedPreview.status === 'pending' ? 'Đang render…' : 'Kết quả mới'}</strong>
          {healedPreview.message && <small>{healedPreview.message}</small>}
        </div>
        {healedPreview.status === 'pending' && (
          <div className="sfg-preview-pending">
            <Loader2 size={28} className="spin" />
            <p>Ảnh thường 15s–2 phút · video 1–3 phút</p>
            <p className="sfg-preview-hint">Quá 5 phút không xong → refresh trang và bấm Tạo lại</p>
          </div>
        )}
        {healedPreview.status === 'error' && (
          <p className="sfg-preview-error">{healedPreview.message}</p>
        )}
        {healedPreview.videoUrl && (
          <video src={healedPreview.videoUrl} controls playsInline className="sfg-preview-media" />
        )}
        {!healedPreview.videoUrl && previewImages.length === 1 && (
          <img src={previewImages[0]} alt="Kết quả" className="sfg-preview-media" />
        )}
        {!healedPreview.videoUrl && previewImages.length > 1 && (
          <div className="sfg-preview-grid">
            {previewImages.map((url, i) => (
              <img key={url} src={url} alt={`#${i + 1}`} />
            ))}
          </div>
        )}
        {isReady && (
          <div className="sfg-preview-actions">
            <button type="button" onClick={onDownloadPreview}><Download size={14} /> Tải</button>
            <button type="button" className="primary" onClick={onOpenEditor}>Timeline Editor →</button>
          </div>
        )}
        {isReady && savedToLibrary != null && savedToLibrary > 0 && (
          <p className="sfg-saved">Đã lưu {savedToLibrary} sản phẩm · <button type="button" onClick={onGoLibrary}>Xem thư viện</button></p>
        )}
        {healedPreview.videoUrl && healedPreview.status === 'ready' && (
          <SocialPublishBar
            videoUrl={healedPreview.videoUrl}
            defaultTitle={healedPreview.message?.slice(0, 80) || 'Video Nô Tì'}
            defaultCaption={healedPreview.message || ''}
          />
        )}
      </div>
    )
  }

  if (panel === 'tools') {
    return (
      <div className="sfg-wrap">
        <header className="sfg-head">
          <h2>Mẫu & sản phẩm</h2>
          <p>Bấm mẫu để áp preset — tự chuyển sang tab Tạo và render</p>
        </header>
        <div className="sfg-samples-grid">
          {samples.map((s) => (
            <SampleCard key={s.id} icon={s.icon} title={s.title} desc={s.desc} tag={s.tag} onClick={s.onClick} />
          ))}
        </div>
        {products.length > 0 && (
          <>
            <h3 className="sfg-subhead">Sản phẩm đã tạo ({products.length})</h3>
            <div className="sfg-products-grid">
              {products.slice(0, 12).map((p) => (
                <button key={p.id} type="button" className="sfg-product" onClick={onOpenEditor} title={p.title}>
                  <ProductThumb item={p} />
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (panel === 'uploads') {
    return (
      <div className="sfg-wrap sfg-wrap-flush">
        <StudioUploadedLibrary projectId={projectId ?? undefined} showDrivePlaceholder />
      </div>
    )
  }

  if (panel === 'pro') {
    return (
      <div className="sfg-wrap">
        <header className="sfg-head">
          <h2>Flow Pro</h2>
          <p>Chọn flow bên trái — preview và sản phẩm hiện ở đây sau khi render</p>
        </header>
        <div className="sfg-pro-grid">
          {STUDIO_PRO_FLOWS.map((f) => (
            <button key={f.id} type="button" className="sfg-pro-card" onClick={() => onStartProFlow(f.id)}>
              <f.icon size={28} strokeWidth={1.25} />
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </button>
          ))}
        </div>
        {renderPreviewCard()}
      </div>
    )
  }

  const showProducts = feedTab === 'all' || feedTab === 'products'
  const showUploads = feedTab === 'all' || feedTab === 'uploads'
  const recentProducts = products.slice(0, feedTab === 'all' ? 8 : 24)
  const recentUploads = uploads.slice(0, feedTab === 'all' ? 6 : 24)

  return (
    <div className="sfg-wrap">
      <header className="sfg-head">
        <h2>{
          toolId === 'motion' ? 'Motion Control'
            : effectiveMode === 'image' ? 'Studio ảnh'
              : 'Studio video'
        }</h2>
        <p>Sản phẩm AI & tài liệu tải lên — tách riêng từng mục</p>
      </header>

      {renderPreviewCard()}

      {!preview && (
        <div className="sfg-empty-hint">
          <Sparkles size={32} />
          <p>Nhập mô tả bên trái → kết quả hiện tại đây</p>
        </div>
      )}

      <div className="sfg-tabs">
        {(['all', 'products', 'uploads'] as FeedTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`sfg-tab${feedTab === t ? ' active' : ''}`}
            onClick={() => setFeedTab(t)}
          >
            {t === 'all' ? 'Tất cả' : t === 'products' ? `Sản phẩm (${products.length})` : `Đã tải (${uploads.length})`}
          </button>
        ))}
      </div>

      {showProducts && recentProducts.length > 0 && (
        <section className="sfg-section">
          <h3><Film size={14} /> Sản phẩm AI</h3>
          <div className="sfg-products-grid">
            {recentProducts.map((p) => (
              <button key={p.id} type="button" className="sfg-product" title={p.prompt || p.title}>
                <ProductThumb item={p} />
                <span>{p.title}</span>
                <small>{productSourceLabel(p.source)}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {showUploads && recentUploads.length > 0 && (
        <section className="sfg-section">
          <h3><ImageIcon size={14} /> Đã tải lên</h3>
          <div className="sfg-products-grid">
            {recentUploads.map((u) => (
              <a key={u.id} href={u.url} target="_blank" rel="noreferrer" className="sfg-product">
                <div className="sfg-thumb">
                  {u.kind === 'video' ? (
                    <img src={studioThumbnailUrl(u.url)} alt={u.name} loading="lazy" />
                  ) : (
                    <img src={u.preview || u.url} alt={u.name} loading="lazy" />
                  )}
                  <span className="sfg-thumb-kind">{u.kind === 'video' ? 'Video' : 'Ảnh'}</span>
                </div>
                <span>{u.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {recentProducts.length === 0 && recentUploads.length === 0 && !preview && (
        <div className="sfg-empty-feed">
          <Wand2 size={36} />
          <p>Chưa có sản phẩm — tạo video/ảnh đầu tiên từ panel Cấu hình</p>
          <button type="button" onClick={() => onPickVideoTool('text2video')}>Bắt đầu Text → Video</button>
        </div>
      )}
    </div>
  )
}
