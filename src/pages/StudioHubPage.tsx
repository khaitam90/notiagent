import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import StudioSectionNav from '../components/studio/StudioSectionNav'
import { loadStudioStorageSettings } from '../lib/studioStorageSettings'
import { pullStudioCloud } from '../lib/studioSync'
import {
  LEGACY_STUDIO_SECTIONS,
  STUDIO_SECTIONS,
  type AiPanel,
  type CreateMode,
  type StudioSectionId,
} from '../lib/studioSections'
import {
  getActiveProjectId, setActiveProjectId,
} from '../lib/studioProjects'
import { useI18n } from '../lib/i18n'

const StudioAiComposer = lazy(() => import('../components/studio/StudioAiComposer'))
const StudioAutomaticPanel = lazy(() => import('../components/studio/StudioAutomaticPanel'))
const StudioProductLibrary = lazy(() => import('../components/studio/StudioProductLibrary'))
const WorkflowHub = lazy(() => import('../components/studio/WorkflowHub'))
const StudioProjectsGallery = lazy(() => import('../components/studio/StudioProjectsGallery'))
const ProjectWorkspace = lazy(() => import('../components/studio/ProjectWorkspace'))

function StudioSectionFallback() {
  const { t } = useI18n()
  return (
    <div style={{ minHeight: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      {t('studio.loading')}
    </div>
  )
}

function parseSection(raw: string | null): StudioSectionId {
  const ids = STUDIO_SECTIONS.map((s) => s.id)
  if (raw && ids.includes(raw as StudioSectionId) && raw !== 'editor') {
    return raw as StudioSectionId
  }
  return 'studio-ai'
}

export default function StudioHubPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const rawSection = params.get('section')
  const section = parseSection(rawSection)
  const toolId = params.get('tool') || undefined
  const createMode = (params.get('mode') as CreateMode) || 'video'
  const aiPanel = (params.get('panel') as AiPanel) || 'create'

  const projectId = params.get('project')

  const [, setProjectId] = useState<string | null>(() => getActiveProjectId())

  useEffect(() => {
    const settings = loadStudioStorageSettings()
    if (settings.cloudSyncEnabled) {
      void pullStudioCloud().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (section !== 'library') return
    const settings = loadStudioStorageSettings()
    if (!settings.cloudSyncEnabled) return
    // Defer cloud sync để UI Tài sản paint trước — tránh block main thread khi merge ~50 sản phẩm
    const t = window.setTimeout(() => {
      void pullStudioCloud().catch(() => {})
    }, 800)
    return () => window.clearTimeout(t)
  }, [section])

  useEffect(() => {
    if (rawSection === 'editor') {
      navigate('/studio/editor', { replace: true })
      return
    }
    if (!rawSection || !(rawSection in LEGACY_STUDIO_SECTIONS)) return
    const legacy = LEGACY_STUDIO_SECTIONS[rawSection]
    if (legacy.section === 'editor') {
      navigate('/studio/editor', { replace: true })
      return
    }
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set('section', legacy.section)
      if (legacy.panel) next.set('panel', legacy.panel)
      else next.delete('panel')
      if (legacy.mode) next.set('mode', legacy.mode)
      return next
    }, { replace: true })
  }, [rawSection, navigate, setParams])

  const setSection = useCallback((id: StudioSectionId) => {
    if (id === 'editor') {
      navigate('/studio/editor')
      return
    }
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set('section', id)
      if (id !== 'studio-ai') {
        next.delete('tool')
        next.delete('mode')
        next.delete('panel')
      }
      return next
    }, { replace: true })
  }, [navigate, setParams])

  const initialMode = useMemo(() => createMode, [createMode, section])

  const setAiPanel = useCallback((panel: AiPanel) => {
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set('section', 'studio-ai')
      next.set('panel', panel)
      if (panel !== 'create') {
        next.delete('tool')
        next.delete('mode')
      }
      return next
    }, { replace: true })
  }, [setParams])

  const renderContent = () => {
    let content: JSX.Element | null = null
    switch (section) {
      case 'studio-ai':
        content = (
          <StudioAiComposer
            initialMode={initialMode}
            initialToolId={toolId}
            initialImageToolId={params.get('imageTool') || undefined}
            initialPanel={aiPanel}
            onPanelChange={setAiPanel}
          />
        )
        break
      case 'automatic':
        content = <StudioAutomaticPanel />
        break
      case 'workflows':
        content = (
          <WorkflowHub
            initialFolderId={params.get('wfFolder')}
            initialWorkflowId={params.get('workflow')}
          />
        )
        break
      case 'library':
        content = (
          <div className="sh-resource-panel">
            <StudioProductLibrary />
          </div>
        )
        break
      case 'projects':
        if (projectId) {
          content = (
            <ProjectWorkspace
              projectId={projectId}
            />
          )
          break
        }
        content = (
          <StudioProjectsGallery
            onOpen={(p) => {
              setProjectId(p.id)
              setActiveProjectId(p.id)
            }}
          />
        )
        break
      default:
        content = null
    }
    return <Suspense fallback={<StudioSectionFallback />}>{content}</Suspense>
  }

  return (
    <div className="sh-hub">
      <header className="sh-hub-header">
        <div className="sh-hub-brand">
          <span className="cc-logo-icon">N</span>
          <span>Studio</span>
        </div>
        <StudioSectionNav active={section} onChange={setSection} />
      </header>
      <main className="sh-hub-main">{renderContent()}</main>
    </div>
  )
}
