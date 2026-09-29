import { useNavigate } from 'react-router-dom'
import { VIDEO_TOOLS, type VideoTool } from '../../lib/videoTools'
import { IMAGE_TOOL_PRESETS } from '../../lib/imageToolPresets'
import { isImagePresetLive, isVideoToolLive } from '../../lib/studioToolsAvailability'

const VIDEO_CATEGORIES = [
  { id: 'create', label: 'Tạo video' },
  { id: 'motion', label: 'Chuyển động & ref' },
  { id: 'style', label: 'Phong cách' },
] as const

function videoCategory(tool: VideoTool): string {
  if (tool.needsVideo || tool.id === 'motion') return 'motion'
  if (['short-film', 'animation', 'ads', 'kol', 'knowledge'].includes(tool.id)) return 'style'
  return 'create'
}

type Props = {
  onPickVideoTool: (toolId: string) => void
  onPickImagePreset: (presetId: string) => void
}

export default function StudioToolsGrid({ onPickVideoTool, onPickImagePreset }: Props) {
  const navigate = useNavigate()

  const handleVideoPick = (tool: VideoTool) => {
    if (!isVideoToolLive(tool.id)) return
    onPickVideoTool(tool.id)
  }

  const handleImagePick = (presetId: string) => {
    if (!isImagePresetLive(presetId)) return
    onPickImagePreset(presetId)
  }

  return (
    <div className="sh-tools">
      <header className="sh-tools-head">
        <h2>Tất cả công cụ</h2>
        <p>
          <span className="sh-tool-legend-live">Sẵn sàng</span>
          {' · '}
          <span className="sh-tool-legend-soon">Sắp có</span>
          {' — chỉ công cụ xanh mới mở workspace render'}
        </p>
      </header>

      {VIDEO_CATEGORIES.map((cat) => {
        const items = VIDEO_TOOLS.filter((t) => videoCategory(t) === cat.id)
        if (!items.length) return null
        return (
          <section key={cat.id} className="sh-tools-section">
            <h3>{cat.label}</h3>
            <div className="sh-tools-grid">
              {items.map((tool) => {
                const live = isVideoToolLive(tool.id)
                return (
                  <button
                    key={tool.id}
                    type="button"
                    className={`sh-tool-card${live ? '' : ' sh-tool-card-soon'}`}
                    onClick={() => handleVideoPick(tool)}
                    disabled={!live}
                    title={live ? tool.desc : 'Công cụ đang phát triển — sẽ mở sau'}
                  >
                    <span className="sh-tool-icon">{tool.icon}</span>
                    <strong>{tool.label}</strong>
                    <small>{tool.desc}</small>
                    <span className="sh-tool-meta">
                      {tool.ratio} · {tool.duration}s · {tool.quality}
                    </span>
                    <div className="sh-tool-badges">
                      {live ? (
                        <span className="sh-tool-badge sh-tool-badge-live">Sẵn sàng</span>
                      ) : (
                        <span className="sh-tool-badge sh-tool-badge-soon">Sắp có</span>
                      )}
                      {(tool.needsImage || tool.needsVideo) && live && (
                        <span className="sh-tool-badge sh-tool-badge-ref">Cần ref</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}

      <section className="sh-tools-section">
        <h3>Tạo ảnh</h3>
        <div className="sh-tools-grid">
          {IMAGE_TOOL_PRESETS.map((p) => {
            const live = isImagePresetLive(p.id)
            return (
              <button
                key={p.id}
                type="button"
                className={`sh-tool-card${live ? '' : ' sh-tool-card-soon'}`}
                onClick={() => handleImagePick(p.id)}
                disabled={!live}
              >
                <span className="sh-tool-icon">{p.icon}</span>
                <strong>{p.label}</strong>
                <small>{p.desc}</small>
                {live && (
                  <div className="sh-tool-badges">
                    <span className="sh-tool-badge sh-tool-badge-live">Sẵn sàng</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="sh-tools-section sh-tools-footer">
        <p>Tham khảo layout:</p>
        <a href="https://kling.ai/app/all-tools?ac=1" target="_blank" rel="noreferrer">Kling All Tools</a>
        {' · '}
        <a href="https://www.capcut.com/magic-tools" target="_blank" rel="noreferrer">CapCut Magic Tools</a>
        {' · '}
        <button type="button" className="sh-link-btn" onClick={() => navigate('/studio?section=pro')}>
          Mở Studio Pro →
        </button>
      </section>
    </div>
  )
}
