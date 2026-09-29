import { useEffect, useState } from 'react'
import { FolderKanban, Plus, Trash2 } from 'lucide-react'
import { generateId } from '../lib/uuid'

type Project = { id: string; name: string; updated: string }

const STORAGE_KEY = 'noti-projects'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setProjects(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }, [])

  const save = (list: Project[]) => {
    setProjects(list)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  }

  const add = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const p: Project = {
      id: generateId(),
      name: trimmed,
      updated: new Date().toLocaleDateString('vi-VN'),
    }
    save([p, ...projects])
    setName('')
  }

  const remove = (id: string) => save(projects.filter((p) => p.id !== id))

  return (
    <main className="main">
      <header className="chat-header">
        <h1>📁 Dự án</h1>
      </header>
      <div className="projects-body">
        <div className="projects-create">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Tên dự án mới..."
            className="projects-input"
          />
          <button type="button" className="btn-new" style={{ margin: 0 }} onClick={add}>
            <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Tạo dự án
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <FolderKanban size={48} style={{ opacity: 0.3 }} />
            <h2>Chưa có dự án</h2>
            <p>Tạo dự án để gom tác vụ Agent, video Studio và nội dung MXH.</p>
          </div>
        ) : (
          <div className="projects-grid">
            {projects.map((p) => (
              <article key={p.id} className="project-card">
                <div className="project-card-icon">
                  <FolderKanban size={22} />
                </div>
                <div className="project-card-body">
                  <h3>{p.name}</h3>
                  <span className="project-card-date">Cập nhật {p.updated}</span>
                </div>
                <button type="button" className="project-card-del" title="Xóa" onClick={() => remove(p.id)}>
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
