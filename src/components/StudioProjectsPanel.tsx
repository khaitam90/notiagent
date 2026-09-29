import { useEffect, useState } from 'react'
import { FolderKanban, Plus, Trash2, Save, FolderOpen, Clock } from 'lucide-react'
import {
  createEmptyProject, deleteStudioProject, loadStudioProjects,
  setActiveProjectId, type StudioProject, upsertStudioProject,
} from '../lib/studioProjects'

type Props = {
  activeProjectId: string | null
  projectName: string
  onOpen: (project: StudioProject) => void
  onSaveCurrent: () => StudioProject | null
  onNewBlank: () => void
}

export default function StudioProjectsPanel({
  activeProjectId, projectName, onOpen, onSaveCurrent, onNewBlank,
}: Props) {
  const [projects, setProjects] = useState<StudioProject[]>([])
  const [newName, setNewName] = useState('')
  const [savedHint, setSavedHint] = useState('')

  const refresh = () => setProjects(loadStudioProjects())

  useEffect(() => { refresh() }, [activeProjectId])

  const createAndOpen = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const p = createEmptyProject(trimmed)
    upsertStudioProject(p)
    setActiveProjectId(p.id)
    setNewName('')
    onOpen(p)
    refresh()
  }

  const saveCurrent = () => {
    const data = onSaveCurrent()
    if (!data) return
    upsertStudioProject(data)
    setActiveProjectId(data.id)
    setSavedHint('Đã lưu')
    refresh()
    setTimeout(() => setSavedHint(''), 2000)
  }

  const openProject = (p: StudioProject) => {
    setActiveProjectId(p.id)
    onOpen(p)
  }

  const remove = (id: string) => {
    deleteStudioProject(id)
    refresh()
  }

  return (
    <div className="vs-studio vs-projects-panel">
      <div className="vs-projects-active">
        <FolderOpen size={16} />
        <div>
          <strong>{projectName}</strong>
          <small>{activeProjectId ? 'Đang mở — tự lưu khi chỉnh sửa' : 'Chưa lưu — bấm Lưu dự án để giữ timeline'}</small>
        </div>
      </div>

      <div className="vs-projects-actions">
        <button type="button" className="vs-project-btn primary" onClick={saveCurrent}>
          <Save size={14} /> Lưu dự án
        </button>
        <button type="button" className="vs-project-btn" onClick={onNewBlank}>
          <Plus size={14} /> Dự án mới
        </button>
        {savedHint && <span className="vs-projects-saved">{savedHint}</span>}
      </div>

      <div className="vs-projects-create">
        <input
          type="text"
          className="vs-projects-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createAndOpen()}
          placeholder="Tên dự án mới..."
        />
        <button type="button" className="vs-project-btn primary" onClick={createAndOpen} disabled={!newName.trim()}>
          <Plus size={14} /> Tạo & mở
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="vs-projects-empty">
          <FolderKanban size={36} />
          <p>Chưa có dự án Studio</p>
          <small>Lưu timeline, media và cài đặt khung hình cho từng video riêng.</small>
        </div>
      ) : (
        <div className="vs-projects-list">
          {projects.map((p) => (
            <article
              key={p.id}
              className={`vs-project-card${activeProjectId === p.id ? ' active' : ''}`}
            >
              <button type="button" className="vs-project-card-main" onClick={() => openProject(p)}>
                <FolderKanban size={20} />
                <div>
                  <h4>{p.name}</h4>
                  <span><Clock size={11} /> {new Date(p.updatedAt).toLocaleString('vi-VN')}</span>
                  <span className="vs-project-meta">{p.clips.length} clip · {p.assets.length} media · {p.ratio}</span>
                </div>
              </button>
              <button type="button" className="vs-project-del" title="Xóa" onClick={() => remove(p.id)}>
                <Trash2 size={14} />
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
