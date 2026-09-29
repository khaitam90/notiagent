import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ChevronDown, Clapperboard, Image as ImageIcon, Loader2, Sparkles, Video, Wrench,
} from 'lucide-react'
import AiVideoStudio from '../AiVideoStudio'
import AiImageStudio from '../AiImageStudio'
import SocialPublishBar from '../SocialPublishBar'
import StudioToolsGrid from './StudioToolsGrid'
import StudioProWorkspace from './StudioProWorkspace'
import StudioMediaPreviewModal from './StudioMediaPreviewModal'
import { type AiPanel, type CreateMode } from '../../lib/studioSections'
import { VIDEO_TOOLS } from '../../lib/videoTools'
import { IMAGE_TOOL_PRESETS } from '../../lib/imageToolPresets'
import { setStudioHandoff } from '../../lib/studioHandoff'
import { saveStudioProductFromPreview } from '../../lib/studioProductLibrary'
import { StudioActiveToolBanner } from './StudioAssetMenus'
import { useI18n } from '../../lib/i18n'

type PreviewState = {
  taskId?: string
  message?: string
  status?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
}

type Props = {
  initialMode?: CreateMode
  initialToolId?: string
  initialImageToolId?: string
  initialPanel?: AiPanel
  onPanelChange?: (panel: AiPanel) => void
}

export default function StudioAiComposer({
  initialMode = 'video',
  initialToolId,
  initialImageToolId,
  initialPanel = 'create',
  onPanelChange,
}: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [panel, setPanelState] = useState<AiPanel>(initialPanel)
  const [mode, setMode] = useState<CreateMode>(initialMode)
  const [modeOpen, setModeOpen] = useState(false)
  const [ratio, setRatio] = useState('9:16')
  const [duration, setDuration] = useState(5)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [imagePreview, setImagePreview] = useState<{ url: string; index: number } | null>(null)
  const [imageRefSeed, setImageRefSeed] = useState<string | null>(null)

  const handleGenerated = useCallback((res: PreviewState) => {
    setPreview(res)
    if (res.status === 'error' || res.status === 'pending' || res.status === 'timeout') return
    if (!res.videoUrl && !res.imageUrl && !res.imageUrls?.length) return
    saveStudioProductFromPreview(res, {
      source: panel === 'pro' ? 'pro' : initialToolId || initialImageToolId ? 'tools' : 'create',
      ratio,
      durationSec: duration,
      prompt: res.message,
    })
  }, [panel, initialToolId, initialImageToolId, ratio, duration])

  const activeVideoTool = initialToolId ? VIDEO_TOOLS.find((t) => t.id === initialToolId) : undefined
  const activeImagePreset = initialImageToolId
    ? IMAGE_TOOL_PRESETS.find((p) => p.id === initialImageToolId)
    : undefined

  useEffect(() => {
    setPanelState(initialPanel)
  }, [initialPanel])

  useEffect(() => {
    if (initialToolId) setMode('video')
    if (initialImageToolId) setMode('image')
  }, [initialToolId, initialImageToolId])

  const aiPanels = [
    { id: 'create' as const, label: t('composer.panel.create') },
    { id: 'tools' as const, label: t('composer.panel.tools') },
    { id: 'uploads' as const, label: t('composer.panel.uploads') },
    { id: 'pro' as const, label: t('composer.panel.pro') },
  ]

  const createModes = [
    { id: 'auto' as const, label: t('composer.mode.auto'), hint: t('composer.mode.autoHint') },
    { id: 'image' as const, label: t('composer.mode.image'), hint: t('composer.mode.imageHint') },
    { id: 'video' as const, label: t('composer.mode.video'), hint: t('composer.mode.videoHint') },
  ]

  const effectiveMode = mode === 'auto' ? 'video' : mode
  const modeMeta = createModes.find((m) => m.id === effectiveMode) ?? createModes[2]
  const hasMedia = !!(preview?.videoUrl || preview?.imageUrl || preview?.imageUrls?.length)
  const isReady = preview?.status === 'ready' && hasMedia

  const openInEditor = useCallback((url?: string) => {
    const mediaUrl = url || preview?.videoUrl || preview?.imageUrl
    if (!mediaUrl) return
    setImagePreview(null)
    setStudioHandoff({
      type: preview?.videoUrl && !url ? 'video' : 'image',
      url: mediaUrl,
      name: preview?.message?.slice(0, 40) || 'Studio AI',
      ratio,
      durationSec: duration,
    })
    navigate('/studio/editor')
  }, [navigate, preview, ratio, duration])

  const openImagePreview = useCallback((url: string, index: number) => {
    setImagePreview({ url, index })
  }, [])

  const useImageAsRef = useCallback((url: string) => {
    setImagePreview(null)
    setImageRefSeed(url)
    setMode('image')
    setPanelState('create')
  }, [])

  const setPanel = useCallback((p: AiPanel) => {
    setPanelState(p)
    onPanelChange?.(p)
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('section', 'studio-ai')
      next.set('panel', p)
      if (p !== 'create') {
        next.delete('tool')
        next.delete('imageTool')
        next.delete('mode')
      }
      return next
    }, { replace: true })
  }, [onPanelChange, setParams])

  const pickVideoTool = useCallback((id: string) => {
    setPreview(null)
    setMode('video')
    setPanelState('create')
    onPanelChange?.('create')
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('section', 'studio-ai')
      next.set('panel', 'create')
      next.set('tool', id)
      next.set('mode', 'video')
      next.delete('imageTool')
      return next
    }, { replace: true })
  }, [onPanelChange, setParams])

  const pickImagePreset = useCallback((id: string) => {
    setPreview(null)
    setMode('image')
    setPanelState('create')
    onPanelChange?.('create')
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('section', 'studio-ai')
      next.set('panel', 'create')
      next.set('imageTool', id)
      next.set('mode', 'image')
      next.delete('tool')
      return next
    }, { replace: true })
  }, [onPanelChange, setParams])

  const clearActiveTool = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('tool')
      next.delete('imageTool')
      return next
    }, { replace: true })
  }, [setParams])

  const renderPreviewArea = () => {
    if (panel === 'tools') {
      return (
        <div className="sh-ai-panel-scroll">
          <StudioToolsGrid
            onPickVideoTool={pickVideoTool}
            onPickImagePreset={pickImagePreset}
          />
        </div>
      )
    }

    if (panel === 'pro') {
      return <StudioProWorkspace />
    }

    return (
      <>
          {(activeVideoTool || activeImagePreset) && !hasMedia && (
            <div className="sh-ai-tool-active">
              {activeVideoTool && (
                <StudioActiveToolBanner
                  label={activeVideoTool.label}
                  meta={`${activeVideoTool.ratio} · ${activeVideoTool.duration}s · ${activeVideoTool.quality}`}
                  onClear={clearActiveTool}
                />
              )}
              {activeImagePreset && (
                <StudioActiveToolBanner
                  label={activeImagePreset.label}
                  meta={activeImagePreset.desc}
                  onClear={clearActiveTool}
                />
              )}
            </div>
          )}
          <div className="sh-ai-preview">
          {preview?.status === 'error' && (
            <div className="sh-ai-empty"><span className="cc-preview-error">{preview.message}</span></div>
          )}
          {preview?.videoUrl && (
            <video src={preview.videoUrl} controls playsInline className="sh-ai-media" />
          )}
          {!preview?.videoUrl && preview?.imageUrls && preview.imageUrls.length > 1 && (
            <div className="sh-ai-media-grid">
              {preview.imageUrls.map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className="sh-ai-media-grid-item sh-ai-media-clickable"
                  onClick={() => openImagePreview(url, i)}
                  onKeyDown={(e) => e.key === 'Enter' && openImagePreview(url, i)}
                  role="button"
                  tabIndex={0}
                  title="Xem trước · tải về · chỉnh sửa"
                >
                  <span className="vs-image-variant-badge">#{i + 1}</span>
                  <img src={url} alt={`Biến thể ${i + 1}`} className="sh-ai-media" />
                  <span className="sh-ai-media-hover">Xem</span>
                </div>
              ))}
            </div>
          )}
          {!preview?.videoUrl && preview?.imageUrl && !(preview.imageUrls && preview.imageUrls.length > 1) && (
            <button
              type="button"
              className="sh-ai-media-single sh-ai-media-clickable"
              onClick={() => openImagePreview(preview.imageUrl!, 0)}
              title="Xem trước · tải về · chỉnh sửa"
            >
              <img src={preview.imageUrl} alt="AI" className="sh-ai-media" />
              <span className="sh-ai-media-hover">Xem</span>
            </button>
          )}
          {preview?.status === 'pending' && (
            <div className="sh-ai-empty">
              <Loader2 size={36} className="spin" />
              <p>{preview.message || 'Đang render…'}</p>
              <small>Thường 1–3 phút tùy model</small>
            </div>
          )}
          {!hasMedia && preview?.status !== 'pending' && preview?.status !== 'error' && (
            <div className="sh-ai-empty sh-ai-empty-guide">
              <Sparkles size={40} className="cc-preview-icon" />
              <p>Tạo video hoặc ảnh AI</p>
              <ol className="sh-ai-steps">
                <li>Chọn <strong>Video</strong> hoặc <strong>Hình ảnh</strong> bên dưới</li>
                <li>Nhập mô tả cảnh — <kbd>Enter</kbd> gửi render</li>
                <li>Xem preview → đăng MXH hoặc mở Timeline Editor</li>
                <li>Sản phẩm tự lưu vào tab <strong>Tài sản</strong></li>
              </ol>
              <div className="sh-ai-quick-links">
                <button type="button" onClick={() => setPanel('tools')}>
                  <Wrench size={14} /> Công cụ preset
                </button>
                <button type="button" onClick={() => setPanel('pro')}>
                  <Clapperboard size={14} /> Flow Pro
                </button>
              </div>
            </div>
          )}
        </div>

        {isReady && (
          <div className="sh-ai-actions">
            <button type="button" className="sh-ai-editor-btn" onClick={() => openInEditor()}>
              Mở Timeline Editor →
            </button>
          </div>
        )}

        {preview?.videoUrl && preview.status === 'ready' && (
          <SocialPublishBar
            videoUrl={preview.videoUrl}
            defaultTitle={preview.message?.slice(0, 80) || 'Video Nô Tì'}
            defaultCaption={preview.message || ''}
          />
        )}
      </>
    )
  }

  return (
    <div className="sh-ai">
      <div className="sh-ai-subnav">
        {aiPanels.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`sh-ai-subnav-tab${panel === p.id ? ' active' : ''}`}
            onClick={() => setPanel(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={`sh-ai-preview-wrap${panel === 'tools' ? ' sh-ai-preview-wrap-scroll' : ''}${panel === 'pro' ? ' sh-ai-preview-wrap-pro' : ''}`}>
        {renderPreviewArea()}
      </div>

      {panel === 'create' && (
        <div className="sh-ai-composer">
          <div className="sh-ai-composer-head">
            <div className="sh-ai-mode-inline">
              <button
                type="button"
                className={`sh-ai-mode-chip${modeOpen ? ' open' : ''}`}
                onClick={() => setModeOpen((o) => !o)}
              >
                {effectiveMode === 'video' ? <Video size={14} /> : <ImageIcon size={14} />}
                <span>{modeMeta.label}</span>
                <ChevronDown size={12} />
              </button>
              {modeOpen && (
                <div className="sh-ai-mode-menu sh-ai-mode-menu-up">
                  {createModes.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`sh-ai-mode-opt${mode === m.id ? ' active' : ''}`}
                      onClick={() => { setMode(m.id); setModeOpen(false); setPreview(null) }}
                    >
                      <strong>{m.label}</strong>
                      <small>{m.hint}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="sh-ai-panel">
            {(mode === 'video' || mode === 'auto') && (
              <AiVideoStudio
                compact
                key={`video-${initialToolId || 'default'}`}
                ratio={ratio}
                duration={duration}
                onRatioChange={setRatio}
                onDurationChange={setDuration}
                initialToolId={initialToolId}
                onGenerated={handleGenerated}
              />
            )}
            {mode === 'image' && (
              <AiImageStudio
                key={`image-${initialImageToolId || 'default'}-${imageRefSeed || 'none'}`}
                ratio={ratio}
                initialPresetId={initialImageToolId}
                initialRefUrl={imageRefSeed || undefined}
                onGenerated={handleGenerated}
              />
            )}
          </div>
        </div>
      )}

      {imagePreview && (
        <StudioMediaPreviewModal
          url={imagePreview.url}
          title={`Ảnh AI${imagePreview.index > 0 ? ` · biến thể #${imagePreview.index + 1}` : ''}`}
          onClose={() => setImagePreview(null)}
          onOpenEditor={() => openInEditor(imagePreview.url)}
          onUseAsRef={() => useImageAsRef(imagePreview.url)}
        />
      )}
    </div>
  )
}
