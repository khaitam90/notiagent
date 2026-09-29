import { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Edit2, Film, Image as ImageIcon, Upload } from 'lucide-react'
import {
  findStudioProject,
  setActiveProjectId,
  upsertStudioProject,
} from '../../lib/studioProjects'
import { saveStudioProductFromPreview } from '../../lib/studioProductLibrary'
import { uploadMedia } from '../../lib/api'
import { registerStudioUpload } from '../../lib/studioAssetLibrary'
import AiVideoStudio from '../AiVideoStudio'
import AiImageStudio from '../AiImageStudio'
import StudioProductLibrary from './StudioProductLibrary'
import StudioUploadedLibrary from './StudioUploadedLibrary'
import { useI18n } from '../../lib/i18n'

type Tab = 'studio' | 'products' | 'uploads'

function parseTab(raw: string | null): Tab {
  if (raw === 'products' || raw === 'uploads') return raw
  return 'studio'
}

type PreviewState = {
  taskId?: string
  message?: string
  status?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
}

type Props = {
  projectId: string
}

/** Không gian làm việc của 1 dự án — Studio tạo AI đầy đủ (model/kích thước/thời lượng) + Sản phẩm + Đã tải lên, đều lọc theo projectId. */
export default function ProjectWorkspace({ projectId }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = parseTab(params.get('tab'))

  const project = useMemo(() => findStudioProject(projectId), [projectId])

  const [mode, setMode] = useState<'image' | 'video'>('image')
  const [ratio, setRatio] = useState('9:16')
  const [duration, setDuration] = useState(5)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const setTab = useCallback((next: Tab) => {
    setParams((p) => {
      const q = new URLSearchParams(p)
      q.set('tab', next)
      return q
    }, { replace: true })
  }, [setParams])

  const backToGallery = () => {
    setActiveProjectId(null)
    setParams((p) => {
      const q = new URLSearchParams(p)
      q.delete('project')
      q.set('section', 'projects')
      return q
    }, { replace: true })
  }

  const rename = () => {
    if (!project) return
    const name = window.prompt(t('project.renamePrompt'), project.name)
    if (!name?.trim()) return
    upsertStudioProject({ ...project, name: name.trim(), updatedAt: new Date().toISOString() })
    navigate(0)
  }

  const handleGenerated = useCallback((res: PreviewState) => {
    if (res.status === 'error' || res.status === 'pending' || res.status === 'timeout') return
    if (!res.videoUrl && !res.imageUrl && !res.imageUrls?.length) return
    saveStudioProductFromPreview(res, {
      source: 'pro',
      ratio,
      durationSec: duration,
      prompt: res.message,
      projectId,
    })
    setStatus(res.videoUrl ? t('project.savedVideo') : t('project.savedImage'))
  }, [ratio, duration, projectId, t])

  const uploadRefToProject = async (file: File) => {
    setBusy(true)
    try {
      const up = await uploadMedia(file, file.type.startsWith('video') ? 'video' : 'image')
      registerStudioUpload({
        kind: file.type.startsWith('video') ? 'video' : 'image',
        name: file.name,
        url: up.url,
        projectId,
      })
      setStatus(t('project.uploadSaved'))
    } catch (e) {
      setStatus(`⚠️ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pw-root">
      <header className="pw-header">
        <button type="button" className="pw-back" onClick={backToGallery} aria-label={t('project.back')}>
          <ArrowLeft size={18} />
        </button>
        <div className="pw-title">
          <h1>{project?.name || t('project.defaultTitle')}</h1>
          <p>{t('project.subtitle')}</p>
        </div>
        <button type="button" className="pw-rename" onClick={rename} title={t('project.rename')}>
          <Edit2 size={16} />
        </button>
      </header>

      <nav className="pw-tabs" aria-label={t('project.tabs')}>
        <button type="button" className={`pw-tab${tab === 'studio' ? ' active' : ''}`} onClick={() => setTab('studio')}>
          {t('project.tab.studio')}
        </button>
        <button type="button" className={`pw-tab${tab === 'products' ? ' active' : ''}`} onClick={() => setTab('products')}>
          {t('project.tab.products')}
        </button>
        <button type="button" className={`pw-tab${tab === 'uploads' ? ' active' : ''}`} onClick={() => setTab('uploads')}>
          {t('project.tab.uploads')}
        </button>
      </nav>

      <div className="pw-body">
      {tab === 'studio' && (
        <div className="pw-studio pw-studio-full">
          <div className="pw-mode-switch">
            <button
              type="button"
              className={`pw-mode-btn${mode === 'image' ? ' active' : ''}`}
              onClick={() => setMode('image')}
            >
              <ImageIcon size={16} /> {t('project.mode.image')}
            </button>
            <button
              type="button"
              className={`pw-mode-btn${mode === 'video' ? ' active' : ''}`}
              onClick={() => setMode('video')}
            >
              <Film size={16} /> {t('project.mode.video')}
            </button>
          </div>

          <div className="pw-ai-panel">
            {mode === 'video' ? (
              <AiVideoStudio
                compact
                ratio={ratio}
                duration={duration}
                onRatioChange={setRatio}
                onDurationChange={setDuration}
                onGenerated={handleGenerated}
              />
            ) : (
              <AiImageStudio
                ratio={ratio}
                onGenerated={handleGenerated}
              />
            )}
          </div>

          {status && <p className="pw-status">{status}</p>}

          <div className="pw-upload-hint">
            <label className="pw-upload-drop">
              <input
                type="file"
                accept="image/*,video/*"
                hidden
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void uploadRefToProject(f)
                  e.target.value = ''
                }}
              />
              <Upload size={16} /> {t('project.uploadHint')}
            </label>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="pw-panel">
          <StudioProductLibrary
            projectId={projectId}
            title={t('project.tab.products')}
            subtitle={t('project.productsSubtitle')}
            showProjectBadge={false}
          />
        </div>
      )}

      {tab === 'uploads' && (
        <div className="pw-panel">
          <StudioUploadedLibrary
            projectId={projectId}
            title={t('project.tab.uploads')}
            subtitle={t('project.uploadsSubtitle')}
          />
        </div>
      )}
      </div>
    </div>
  )
}
