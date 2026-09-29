import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Copy, Edit2, ExternalLink, Loader2, Search } from 'lucide-react'
import { fetchAgentCapabilities, fetchAgentStatus, type AgentStatus } from '../lib/api'
import { createChatSession, setActiveSessionId, upsertChatSession } from '../lib/chatSessions'

export default function AgentsPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const [toolCount, setToolCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAgentStatus(), fetchAgentCapabilities()])
      .then(([st, caps]) => {
        setStatus(st)
        setToolCount(caps.connections.filter((c) => c.configured).length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const agent = useMemo(
    () => ({
      name: 'Super Agent Nô Tì',
      description:
        'Agent đa năng với 6 tools n8n — VPS, tìm kiếm web, RAG KB, Studio video, HTTP API, đọc bài viết URL.',
      live: status?.webhook_ok ?? false,
      tools: toolCount,
      skills: status?.skills ?? 7,
    }),
    [status, toolCount],
  )

  const openAgent = () => {
    const created = createChatSession('agent', 'agent')
    upsertChatSession(created)
    setActiveSessionId(created.id)
    navigate('/agent')
  }

  const visible =
    !searchQuery ||
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())

  return (
    <main className="agents-page">
      <header className="agents-page-header">
        <div>
          <h1>Quản lý Agent</h1>
          <p>Super Agent production — trạng thái realtime từ VPS</p>
        </div>
        <button type="button" className="agent-card-open" style={{ width: 'auto', margin: 0 }} onClick={openAgent}>
          <Bot size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Mở chat
        </button>
      </header>

      <div className="agents-page-search">
        <Search size={16} className="agents-page-search-icon" />
        <input
          type="search"
          placeholder="Tìm agent..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="agents-page-body">
        {loading ? (
          <div className="agents-page-empty">
            <Loader2 size={28} className="spin" />
            <p>Đang kiểm tra Super Agent...</p>
          </div>
        ) : !visible ? (
          <div className="agents-page-empty"><p>Không tìm thấy agent phù hợp</p></div>
        ) : (
          <div className="agents-grid" style={{ gridTemplateColumns: '1fr' }}>
            <article className={`agent-card selected${agent.live ? '' : ' inactive'}`}>
              <div className="agent-card-top">
                <span className="agent-card-icon">🤖</span>
                <div className="agent-card-actions">
                  <button type="button" onClick={openAgent} title="Mở chat"><ExternalLink size={14} /></button>
                  <button type="button" onClick={openAgent} title="Kỹ năng & kết nối"><Edit2 size={14} /></button>
                  <button type="button" disabled title="Sao chép — sắp có"><Copy size={14} /></button>
                </div>
              </div>
              <h3>{agent.name}</h3>
              <p>{agent.description}</p>
              <span className="agent-card-meta">
                {agent.tools} kết nối · {agent.skills} kỹ năng ·{' '}
                {status?.video_studio ? 'Studio bật' : 'Studio tắt'}
                {status && !status.webhook_ok ? ` · Webhook: ${status.detail.slice(0, 40)}` : ''}
              </span>
              <footer>
                <span className={`agent-status ${agent.live ? 'active' : 'inactive'}`}>
                  <i /> {agent.live ? 'LIVE · Tools n8n' : 'Dự phòng · Chat only'}
                </span>
                <span>{status?.connections_configured}/{status?.connections_total} API OK</span>
              </footer>
              <button type="button" className="agent-card-open" onClick={openAgent}>
                Bắt đầu phiên Super Agent
              </button>
            </article>
          </div>
        )}
      </div>
    </main>
  )
}
