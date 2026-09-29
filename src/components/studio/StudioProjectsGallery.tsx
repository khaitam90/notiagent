import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Copy,
  Edit2,
  FileText,
  FolderPlus,
  Grid,
  Image,
  List,
  MoreVertical,
  Search,
  Trash2,
  Video,
} from 'lucide-react'
import {
  createNamedWorkspace,
  deleteStudioProject,
  loadStudioProjects,
  setActiveProjectId,
  upsertStudioProject,
  type StudioProject,
} from '../../lib/studioProjects'
import { countAssetsForProject } from '../../lib/studioAssetLibrary'
import { countProductsForProject } from '../../lib/studioProductLibrary'

export type GalleryProject = {
  id: string
  name: string
  description: string
  type: 'video' | 'image' | 'document'
  thumbnail: string
  status: 'draft' | 'processing' | 'completed'
  createdAt: string
  updatedAt: string
  progress?: number
}

function formatRelative(iso: string) {
  const diff = Date.now() - Date.parse(iso)
  if (Number.isNaN(diff)) return iso
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

function mapStudioProject(p: StudioProject): GalleryProject {
  const productCount = countProductsForProject(p.id)
  const uploadCount = countAssetsForProject(p.id)
  const hasVideo = p.clips.some((c) => c.type === 'video') || productCount > 0
  const hasImage = p.clips.some((c) => c.type === 'image') || p.assets.some((a) => a.type === 'image')
  const type: GalleryProject['type'] = hasVideo ? 'video' : hasImage ? 'image' : 'document'
  const thumbnail = type === 'video' ? '🎬' : type === 'image' ? '🖼️' : '📁'
  const status: GalleryProject['status'] =
    productCount > 0 || p.clips.length > 0 ? 'completed' : uploadCount > 0 ? 'processing' : 'draft'

  return {
    id: p.id,
    name: p.name,
    description: `${productCount} sản phẩm · ${uploadCount} tải lên · ${p.ratio}`,
    type,
    thumbnail,
    status,
    createdAt: formatRelative(p.updatedAt),
    updatedAt: formatRelative(p.updatedAt),
  }
}

type Props = {
  onOpen?: (project: StudioProject) => void
}

export default function StudioProjectsGallery({ onOpen }: Props) {
  const [, setParams] = useSearchParams()
  const [refreshKey, setRefreshKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | GalleryProject['type']>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const projects = useMemo(() => {
    return loadStudioProjects()
      .filter((p) => p.userCreated !== false)
      .map(mapStudioProject)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          project.name.toLowerCase().includes(q) || project.description.toLowerCase().includes(q)
        const matchesType = filterType === 'all' || project.type === filterType
        return matchesSearch && matchesType
      }),
    [projects, searchQuery, filterType],
  )

  const openProject = (project: GalleryProject) => {
    const found = loadStudioProjects().find((p) => p.id === project.id)
    if (!found) return
    setActiveProjectId(found.id)
    onOpen?.(found)
    setParams((p) => {
      const next = new URLSearchParams(p)
      next.set('section', 'projects')
      next.set('project', found.id)
      next.set('tab', 'products')
      return next
    }, { replace: true })
  }

  const handleNew = () => {
    const name = window.prompt('Tên không gian dự án mới', `Dự án ${new Date().toLocaleDateString('vi-VN')}`)
    if (!name?.trim()) return
    const p = createNamedWorkspace(name.trim())
    setActiveProjectId(p.id)
    onOpen?.(p)
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('section', 'projects')
      next.set('project', p.id)
      next.set('tab', 'studio')
      return next
    }, { replace: true })
  }

  const handleRename = (project: GalleryProject, e: React.MouseEvent) => {
    e.stopPropagation()
    const found = loadStudioProjects().find((p) => p.id === project.id)
    if (!found) return
    const name = window.prompt('Đổi tên dự án', found.name)
    if (!name?.trim()) return
    upsertStudioProject({ ...found, name: name.trim(), updatedAt: new Date().toISOString() })
    setRefreshKey((k) => k + 1)
  }

  const handleDelete = (project: GalleryProject) => {
    if (!window.confirm(`Xóa dự án「${project.name}」? Sản phẩm vẫn giữ ở tab Tài sản.`)) return
    deleteStudioProject(project.id)
    setRefreshKey((k) => k + 1)
  }

  const StatusBadge = ({ status }: { status: GalleryProject['status'] }) => {
    if (status === 'completed') {
      return <span className="studio-gallery-badge done">Hoạt động</span>
    }
    if (status === 'processing') {
      return <span className="studio-gallery-badge processing">Đang làm</span>
    }
    return <span className="studio-gallery-badge draft">Mới</span>
  }

  return (
    <div className="studio-gallery-page">
      <header className="studio-gallery-header">
        <div>
          <h1>Dự án</h1>
          <p className="studio-gallery-lead">
            Tạo nhiều không gian làm việc — mỗi dự án có Studio, tải lên và sản phẩm riêng
          </p>
        </div>
        <button type="button" className="studio-gallery-more" aria-label="Tùy chọn">
          <MoreVertical size={20} />
        </button>
      </header>

      <div className="studio-gallery-toolbar">
        <div className="studio-gallery-search">
          <Search size={18} className="studio-gallery-search-icon" />
          <input
            type="search"
            placeholder="Tìm kiếm dự án..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="studio-gallery-filters">
          <div className="studio-gallery-type-btns">
            {(
              [
                { id: 'all', label: 'Tất cả', icon: null },
                { id: 'video', label: 'Video', icon: Video },
                { id: 'image', label: 'Ảnh', icon: Image },
                { id: 'document', label: 'Tài liệu', icon: FileText },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`studio-gallery-type-btn${filterType === id ? ' active' : ''}`}
                onClick={() => setFilterType(id)}
              >
                {Icon && <Icon size={16} />}
                {label}
              </button>
            ))}
          </div>
          <div className="studio-gallery-view-toggle">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              aria-label="Lưới"
            >
              <Grid size={18} />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              aria-label="Danh sách"
            >
              <List size={18} />
            </button>
          </div>
        </div>

        <button type="button" className="studio-gallery-new" onClick={handleNew}>
          <FolderPlus size={18} />
          Không gian mới
        </button>
      </div>

      <div className="studio-gallery-body">
        {filteredProjects.length === 0 ? (
          <div className="studio-gallery-empty">
            <FolderPlus size={48} />
            <p>Chưa có dự án nào</p>
            <span>Tạo không gian mới để gom sản phẩm, tải lên và Studio riêng biệt</span>
            <button type="button" className="studio-gallery-new" onClick={handleNew}>
              Không gian mới
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="studio-gallery-grid">
            {filteredProjects.map((project) => (
              <article
                key={project.id}
                className="studio-gallery-card"
                onClick={() => openProject(project)}
                onKeyDown={(e) => e.key === 'Enter' && openProject(project)}
                role="button"
                tabIndex={0}
              >
                <div className="studio-gallery-thumb">
                  <span>{project.thumbnail}</span>
                </div>
                <div className="studio-gallery-card-body">
                  <h3>{project.name}</h3>
                  <p>{project.description}</p>
                  <StatusBadge status={project.status} />
                  <footer>
                    <span>Sửa: {project.updatedAt}</span>
                    <div className="studio-gallery-card-actions">
                      <button type="button" onClick={(e) => handleRename(project, e)} title="Đổi tên">
                        <Edit2 size={14} />
                      </button>
                      <button type="button" onClick={(e) => e.stopPropagation()} title="Sao chép">
                        <Copy size={14} />
                      </button>
                      <button
                        type="button"
                        className="danger"
                        title="Xóa"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(project)
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="studio-gallery-list">
            {filteredProjects.map((project) => (
              <article key={project.id} className="studio-gallery-list-row">
                <button type="button" className="studio-gallery-list-main" onClick={() => openProject(project)}>
                  <span className="studio-gallery-thumb-sm">{project.thumbnail}</span>
                  <div>
                    <h3>{project.name}</h3>
                    <p>{project.description}</p>
                    <StatusBadge status={project.status} />
                  </div>
                </button>
                <div className="studio-gallery-list-end">
                  <span>{project.updatedAt}</span>
                  <button type="button" onClick={(e) => handleRename(project, e)}>
                    <Edit2 size={16} />
                  </button>
                  <button type="button" className="danger" onClick={() => handleDelete(project)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
