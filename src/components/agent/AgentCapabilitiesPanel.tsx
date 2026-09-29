import { Link2, Puzzle, X } from 'lucide-react'
import type { AgentCapabilities } from '../../lib/api'
import type { AgentSettings } from '../../lib/agentSettings'

const CATEGORY_LABEL: Record<string, string> = {
  communication: 'Giao tiếp',
  data: 'Dữ liệu',
  automation: 'Tự động hóa',
  creative: 'Sáng tạo',
  social: 'Mạng xã hội',
  research: 'Nghiên cứu',
}

type Props = {
  open: boolean
  tab: 'connections' | 'skills'
  onTab: (t: 'connections' | 'skills') => void
  onClose: () => void
  caps: AgentCapabilities | null
  settings: AgentSettings
  isConnectionOn: (id: string) => boolean
  isSkillOn: (id: string) => boolean
  onToggleConnection: (id: string) => void
  onToggleSkill: (id: string) => void
  onPickSkill: (id: string) => void
}

export default function AgentCapabilitiesPanel({
  open,
  tab,
  onTab,
  onClose,
  caps,
  settings,
  isConnectionOn,
  isSkillOn,
  onToggleConnection,
  onToggleSkill,
  onPickSkill,
}: Props) {
  if (!open) return null

  const grouped = (caps?.connections ?? []).reduce<Record<string, AgentCapabilities['connections']>>((acc, c) => {
    const k = c.category || 'other'
    if (!acc[k]) acc[k] = []
    acc[k].push(c)
    return acc
  }, {})

  return (
    <>
      <button type="button" className="agent-cap-backdrop" aria-label="Đóng" onClick={onClose} />
      <aside className="agent-cap-panel" aria-label="Kết nối và Kỹ năng">
        <header className="agent-cap-head">
          <div>
            <h2>Khả năng Agent</h2>
            <p>Giống Manus — bật kết nối & kỹ năng cho Super Agent</p>
          </div>
          <button type="button" className="agent-cap-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </header>

        <div className="agent-cap-tabs">
          <button
            type="button"
            className={`agent-cap-tab${tab === 'connections' ? ' active' : ''}`}
            onClick={() => onTab('connections')}
          >
            <Link2 size={15} />
            Kết nối
          </button>
          <button
            type="button"
            className={`agent-cap-tab${tab === 'skills' ? ' active' : ''}`}
            onClick={() => onTab('skills')}
          >
            <Puzzle size={15} />
            Kỹ năng
          </button>
        </div>

        <div className="agent-cap-body">
          {tab === 'connections' && (
            <>
              {Object.entries(grouped).map(([cat, items]) => (
                <section key={cat} className="agent-cap-section">
                  <h3>{CATEGORY_LABEL[cat] || cat}</h3>
                  {items.map((c) => (
                    <label
                      key={c.id}
                      className={`agent-cap-row${!c.configured ? ' disabled' : ''}${isConnectionOn(c.id) ? ' on' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isConnectionOn(c.id)}
                        disabled={!c.configured}
                        onChange={() => onToggleConnection(c.id)}
                      />
                      <div className="agent-cap-row-text">
                        <strong>{c.name}</strong>
                        <span>{c.desc}</span>
                        {!c.configured && <em>Chưa cấu hình API</em>}
                      </div>
                    </label>
                  ))}
                </section>
              ))}
            </>
          )}

          {tab === 'skills' && (
            <section className="agent-cap-section">
              <h3>Chọn kỹ năng chính</h3>
              <p className="agent-cap-hint">Kỹ năng active: <strong>{settings.skillId}</strong> — gửi kèm mỗi tin Super Agent</p>
              {(caps?.skills ?? []).map((s) => (
                <label
                  key={s.id}
                  className={`agent-cap-row skill${settings.skillId === s.id ? ' primary' : ''}${isSkillOn(s.id) ? ' on' : ''}`}
                >
                  <input
                    type="radio"
                    name="agent-skill"
                    checked={settings.skillId === s.id}
                    onChange={() => onPickSkill(s.id)}
                  />
                  <div className="agent-cap-row-text">
                    <strong>{s.name}</strong>
                    <span>{s.desc}</span>
                  </div>
                  <input
                    type="checkbox"
                    className="agent-cap-skill-toggle"
                    checked={isSkillOn(s.id)}
                    title="Cho phép Agent dùng kỹ năng này"
                    onChange={(e) => {
                      e.stopPropagation()
                      onToggleSkill(s.id)
                    }}
                  />
                </label>
              ))}
            </section>
          )}
        </div>
      </aside>
    </>
  )
}
