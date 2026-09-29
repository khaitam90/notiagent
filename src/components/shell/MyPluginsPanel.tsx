import { useMemo, useState } from 'react'
import { Check, Grid, List, Plus, Search, Trash2, X } from 'lucide-react'
import { useAgentCapabilities } from '../../hooks/useAgentCapabilities'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type PluginItem = {
  id: string
  name: string
  description: string
  icon: string
  category: string
  isConnected: boolean
  configured: boolean
  version: string
  kind: 'connection' | 'skill'
  skillId?: string
}

const CATEGORY_LABEL: Record<string, string> = {
  all: 'Tất cả',
  communication: 'Giao tiếp',
  data: 'Dữ liệu',
  automation: 'Tự động hóa',
  creative: 'Sáng tạo',
  social: 'Mạng xã hội',
  research: 'Nghiên cứu',
  skills: 'Kỹ năng',
}

const PLUGIN_ICONS: Record<string, string> = {
  telegram: '📱',
  google_sheets: '📊',
  n8n: '⚡',
  studio_kie: '🎬',
  unipost: '📱',
  serper: '🔍',
  perplexity: '🧠',
  qdrant: '📚',
  browser: '🌐',
  mpt: '🎥',
}

function iconFor(id: string, category: string) {
  return PLUGIN_ICONS[id] || (
    {
      communication: '💬',
      data: '📁',
      automation: '⚙️',
      creative: '🎨',
      social: '📣',
      research: '🔎',
      skills: '🧩',
    }[category] || '🔌'
  )
}

export function MyPluginsPanel({ isOpen, onClose }: Props) {
  const { caps, isConnectionOn, isSkillOn, flipConnection, flipSkill } = useAgentCapabilities()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const plugins = useMemo<PluginItem[]>(() => {
    const connections = (caps?.connections ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.desc,
      icon: iconFor(c.id, c.category),
      category: c.category,
      isConnected: isConnectionOn(c.id),
      configured: c.configured,
      version: '1.0',
      kind: 'connection' as const,
    }))
    const skills = (caps?.skills ?? []).map((s) => ({
      id: `skill:${s.id}`,
      name: s.name,
      description: s.desc,
      icon: '🧩',
      category: 'skills',
      isConnected: isSkillOn(s.id),
      configured: true,
      version: '1.0',
      kind: 'skill' as const,
      skillId: s.id,
    }))
    return [...connections, ...skills]
  }, [caps, isConnectionOn, isSkillOn])

  const categories = useMemo(() => {
    const ids = new Set(plugins.map((p) => p.category))
    return [
      { id: 'all', label: CATEGORY_LABEL.all },
      ...Array.from(ids).map((id) => ({ id, label: CATEGORY_LABEL[id] || id })),
    ]
  }, [plugins])

  const filteredPlugins = useMemo(
    () =>
      plugins.filter((plugin) => {
        const q = searchQuery.toLowerCase()
        const matchesSearch =
          plugin.name.toLowerCase().includes(q) || plugin.description.toLowerCase().includes(q)
        const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory
        return matchesSearch && matchesCategory
      }),
    [plugins, searchQuery, selectedCategory],
  )

  const handleToggle = (plugin: PluginItem) => {
    if (plugin.kind === 'connection') {
      if (!plugin.configured) return
      flipConnection(plugin.id)
      return
    }
    if (plugin.skillId) flipSkill(plugin.skillId)
  }

  const handleDisconnect = (plugin: PluginItem) => {
    if (!plugin.isConnected) return
    handleToggle(plugin)
  }

  if (!isOpen) return null

  return (
    <div className="plugins-modal-root" role="dialog" aria-modal="true" aria-label="Plugin của tôi">
      <button type="button" className="plugins-modal-backdrop" aria-label="Đóng" onClick={onClose} />
      <div className="plugins-modal">
        <header className="plugins-modal-header">
          <h2>Plugin của tôi</h2>
          <button type="button" className="plugins-modal-close" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>

        <div className="plugins-modal-toolbar">
          <div className="plugins-modal-search-row">
            <div className="plugins-modal-search">
              <Search size={18} className="plugins-modal-search-icon" />
              <input
                type="search"
                placeholder="Tìm kiếm kết nối, kỹ năng, nguồn dữ liệu"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="button" className="plugins-modal-browse" disabled title="Sắp ra mắt">
              <Plus size={18} /> Duyệt plugin
            </button>
          </div>

          <div className="plugins-modal-filters">
            <div className="plugins-modal-cats">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`plugins-cat-btn${selectedCategory === cat.id ? ' active' : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="plugins-view-toggle">
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
        </div>

        <div className="plugins-modal-body">
          {filteredPlugins.length === 0 ? (
            <div className="plugins-modal-empty">
              <p>Không tìm thấy plugin</p>
              <span>Hãy thêm plugin từ &quot;Duyệt plugin&quot;</span>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="plugins-grid">
              {filteredPlugins.map((plugin) => (
                <article key={plugin.id} className="plugin-card">
                  <div className="plugin-card-top">
                    <span className="plugin-card-icon">{plugin.icon}</span>
                    <div className="plugin-card-actions">
                      <button
                        type="button"
                        title={plugin.isConnected ? 'Ngắt kết nối' : 'Kết nối'}
                        className={plugin.isConnected ? 'on' : ''}
                        disabled={!plugin.configured}
                        onClick={() => handleToggle(plugin)}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        type="button"
                        title="Gỡ"
                        className="danger"
                        disabled={!plugin.isConnected}
                        onClick={() => handleDisconnect(plugin)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h3>{plugin.name}</h3>
                  <p>{plugin.description}</p>
                  <footer>
                    <span>v{plugin.version}</span>
                    <span className={`plugin-status${plugin.isConnected ? ' on' : ''}`}>
                      {!plugin.configured
                        ? 'Chưa cấu hình'
                        : plugin.isConnected
                          ? 'Đã kết nối'
                          : 'Chưa kết nối'}
                    </span>
                  </footer>
                </article>
              ))}
            </div>
          ) : (
            <div className="plugins-list">
              {filteredPlugins.map((plugin) => (
                <article key={plugin.id} className="plugin-list-row">
                  <div className="plugin-list-main">
                    <span className="plugin-card-icon">{plugin.icon}</span>
                    <div>
                      <h3>{plugin.name}</h3>
                      <p>{plugin.description}</p>
                    </div>
                  </div>
                  <div className="plugin-list-end">
                    <span className="plugin-version">v{plugin.version}</span>
                    <span className={`plugin-status${plugin.isConnected ? ' on' : ''}`}>
                      {!plugin.configured
                        ? 'Chưa cấu hình'
                        : plugin.isConnected
                          ? 'Đã kết nối'
                          : 'Chưa kết nối'}
                    </span>
                    <button
                      type="button"
                      className={plugin.isConnected ? 'on' : ''}
                      disabled={!plugin.configured}
                      onClick={() => handleToggle(plugin)}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={!plugin.isConnected}
                      onClick={() => handleDisconnect(plugin)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <footer className="plugins-modal-footer">
          <button type="button" className="plugins-modal-done" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </div>
    </div>
  )
}
