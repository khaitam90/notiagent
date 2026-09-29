import { VIDEO_TOOLS, type VideoTool } from '../../lib/videoTools'
import { IMAGE_TOOL_PRESETS } from '../../lib/imageToolPresets'
import { isImagePresetLive, isVideoToolLive } from '../../lib/studioToolsAvailability'

type Props = {
  onPickVideoTool: (toolId: string) => void
  onPickImagePreset: (presetId: string) => void
}

function ToolRow({
  icon, label, desc, live, onClick,
}: { icon: string; label: string; desc: string; live: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`stc-row${live ? '' : ' soon'}`} onClick={onClick} disabled={!live}>
      <span className="stc-icon">{icon}</span>
      <span className="stc-text">
        <strong>{label}</strong>
        <small>{desc}</small>
      </span>
      <span className={`stc-badge${live ? ' live' : ''}`}>{live ? 'Sẵn sàng' : 'Sắp'}</span>
    </button>
  )
}

export default function StudioToolsCompact({ onPickVideoTool, onPickImagePreset }: Props) {
  const pickVideo = (tool: VideoTool) => {
    if (!isVideoToolLive(tool.id)) return
    onPickVideoTool(tool.id)
  }

  return (
    <div className="stc-wrap">
      <p className="stc-hint">Chọn công cụ — mẫu hiển thị bên phải, bấm để tạo tương tự</p>
      <div className="stc-section">
        <h4>Video</h4>
        {VIDEO_TOOLS.map((tool) => (
          <ToolRow
            key={tool.id}
            icon={tool.icon}
            label={tool.label}
            desc={tool.desc}
            live={isVideoToolLive(tool.id)}
            onClick={() => pickVideo(tool)}
          />
        ))}
      </div>
      <div className="stc-section">
        <h4>Ảnh</h4>
        {IMAGE_TOOL_PRESETS.map((p) => (
          <ToolRow
            key={p.id}
            icon={p.icon}
            label={p.label}
            desc={p.desc}
            live={isImagePresetLive(p.id)}
            onClick={() => isImagePresetLive(p.id) && onPickImagePreset(p.id)}
          />
        ))}
      </div>
    </div>
  )
}
